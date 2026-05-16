use std::sync::Arc;
use std::sync::mpsc::Sender;
use std::thread;
use std::time::Duration;

use parking_lot::Mutex;
use rodio::source::Source;
use rustfft::num_complex::Complex;
use rustfft::FftPlanner;

use crate::player::{Event, SpectrumEvent};

const TAP_CAPACITY: usize = 8192;
const FFT_SIZE: usize = 1024;
const NUM_BANDS: usize = 48;
const BATCH: usize = 128;
const FRAME_INTERVAL_MS: u64 = 20;

pub struct TapBuffer {
    samples: Vec<f32>,
    pos: usize,
    sample_rate: u32,
    channels: u16,
}

impl TapBuffer {
    pub fn new() -> Self {
        Self {
            samples: vec![0.0; TAP_CAPACITY],
            pos: 0,
            sample_rate: 0,
            channels: 1,
        }
    }

    pub fn set_info(&mut self, sample_rate: u32, channels: u16) {
        self.sample_rate = sample_rate;
        self.channels = channels.max(1);
    }

    fn write_batch(&mut self, batch: &[f32]) {
        for &v in batch {
            self.samples[self.pos] = v;
            self.pos = (self.pos + 1) % TAP_CAPACITY;
        }
    }

    pub fn reset(&mut self) {
        for s in self.samples.iter_mut() {
            *s = 0.0;
        }
        self.pos = 0;
    }

    fn snapshot(&self, dst: &mut [f32]) -> (u32, u16) {
        let n = dst.len().min(TAP_CAPACITY);
        let start = (self.pos + TAP_CAPACITY - n) % TAP_CAPACITY;
        for i in 0..n {
            dst[i] = self.samples[(start + i) % TAP_CAPACITY];
        }
        (self.sample_rate, self.channels)
    }
}

pub struct SampleTap<S>
where
    S: Source<Item = f32>,
{
    inner: S,
    tap: Arc<Mutex<TapBuffer>>,
    local: Vec<f32>,
}

impl<S> SampleTap<S>
where
    S: Source<Item = f32>,
{
    pub fn new(inner: S, tap: Arc<Mutex<TapBuffer>>) -> Self {
        let sr = inner.sample_rate();
        let ch = inner.channels();
        {
            let mut t = tap.lock();
            t.set_info(sr, ch);
            t.reset();
        }
        Self {
            inner,
            tap,
            local: Vec::with_capacity(BATCH),
        }
    }
}

impl<S> Iterator for SampleTap<S>
where
    S: Source<Item = f32>,
{
    type Item = f32;
    fn next(&mut self) -> Option<f32> {
        let v = self.inner.next()?;
        self.local.push(v);
        if self.local.len() >= BATCH {
            self.tap.lock().write_batch(&self.local);
            self.local.clear();
        }
        Some(v)
    }
    fn size_hint(&self) -> (usize, Option<usize>) {
        self.inner.size_hint()
    }
}

impl<S> Source for SampleTap<S>
where
    S: Source<Item = f32>,
{
    fn current_frame_len(&self) -> Option<usize> {
        self.inner.current_frame_len()
    }
    fn channels(&self) -> u16 {
        self.inner.channels()
    }
    fn sample_rate(&self) -> u32 {
        self.inner.sample_rate()
    }
    fn total_duration(&self) -> Option<Duration> {
        self.inner.total_duration()
    }
}

pub fn spawn_fft_thread(tap: Arc<Mutex<TapBuffer>>, event_tx: Sender<Event>) {
    thread::spawn(move || {
        let mut planner = FftPlanner::<f32>::new();
        let fft = planner.plan_fft_forward(FFT_SIZE);
        let mut snapshot = vec![0.0f32; FFT_SIZE * 4];
        let mut mono = vec![0.0f32; FFT_SIZE];
        let mut fft_buf = vec![Complex::new(0.0, 0.0); FFT_SIZE];
        let interval = Duration::from_millis(FRAME_INTERVAL_MS);
        loop {
            let (sample_rate, channels) = {
                let t = tap.lock();
                let need = FFT_SIZE * t.channels.max(1) as usize;
                if snapshot.len() != need {
                    snapshot.resize(need, 0.0);
                }
                t.snapshot(&mut snapshot)
            };

            let bands = if sample_rate == 0 {
                vec![0.0; NUM_BANDS]
            } else {
                if channels >= 2 {
                    for (i, chunk) in snapshot.chunks(channels as usize).take(FFT_SIZE).enumerate()
                    {
                        mono[i] = chunk.iter().sum::<f32>() / chunk.len() as f32;
                    }
                } else {
                    mono[..FFT_SIZE].copy_from_slice(&snapshot[..FFT_SIZE]);
                }

                for i in 0..FFT_SIZE {
                    let s = mono[i];
                    let w = 0.5
                        - 0.5
                            * (2.0 * std::f32::consts::PI * i as f32 / (FFT_SIZE - 1) as f32)
                                .cos();
                    fft_buf[i] = Complex::new(s * w, 0.0);
                }
                fft.process(&mut fft_buf);
                compute_bands(&fft_buf, sample_rate)
            };

            if event_tx.send(Event::Spectrum(SpectrumEvent { bands })).is_err() {
                break;
            }
            thread::sleep(interval);
        }
    });
}

fn compute_bands(spectrum: &[Complex<f32>], sample_rate: u32) -> Vec<f32> {
    let n = spectrum.len();
    let nyquist = sample_rate as f32 / 2.0;
    let min_freq = 40.0f32;
    let max_freq = nyquist.min(16000.0).max(min_freq + 1.0);
    let log_min = min_freq.ln();
    let log_max = max_freq.ln();

    let mut bands = vec![0.0f32; NUM_BANDS];
    for b in 0..NUM_BANDS {
        let f_lo = (log_min + (log_max - log_min) * b as f32 / NUM_BANDS as f32).exp();
        let f_hi =
            (log_min + (log_max - log_min) * (b + 1) as f32 / NUM_BANDS as f32).exp();
        let bin_lo = ((f_lo * n as f32 / sample_rate as f32).round() as usize)
            .max(1)
            .min(n / 2);
        let bin_hi = ((f_hi * n as f32 / sample_rate as f32).round() as usize)
            .max(bin_lo + 1)
            .min(n / 2);
        let mut sum = 0.0f32;
        let mut count = 0;
        for k in bin_lo..bin_hi {
            sum += spectrum[k].norm();
            count += 1;
        }
        let mag = if count > 0 { sum / count as f32 } else { 0.0 };
        // Normalize: divide by FFT_SIZE/2, then take log-ish curve
        let norm = (mag / (FFT_SIZE as f32 * 0.25)).clamp(0.0, 1.0);
        bands[b] = norm.powf(0.5);
    }
    bands
}
