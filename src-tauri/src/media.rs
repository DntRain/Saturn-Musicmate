use std::path::Path;
use std::time::Duration;

use base64::engine::general_purpose;
use base64::Engine;
use image::imageops::FilterType;
use lofty::file::TaggedFileExt;
use lofty::picture::PictureType;
use lofty::probe::Probe;
use lofty::tag::{Accessor, ItemKey};
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct LyricLine {
    pub time_ms: u64,
    pub text: String,
}

#[derive(Serialize, Clone, Default)]
pub struct Lyrics {
    pub source: String,
    pub raw: String,
    pub synced: Vec<LyricLine>,
}

pub fn get_cover(path: &Path) -> Result<Option<String>, String> {
    if !path.exists() {
        return Err(format!("media file does not exist: {}", path.display()));
    }

    let tagged = Probe::open(path)
        .map_err(|e| format!("open media: {e}"))?
        .read()
        .map_err(|e| format!("read media tags: {e}"))?;
    let tag = match tagged.primary_tag().or_else(|| tagged.first_tag()) {
        Some(tag) => tag,
        None => return Ok(None),
    };
    let pic = tag
        .pictures()
        .iter()
        .find(|p| p.pic_type() == PictureType::CoverFront)
        .or_else(|| tag.pictures().first());
    let Some(pic) = pic else {
        return Ok(None);
    };
    let mime = pic
        .mime_type()
        .map(|m| m.as_str())
        .unwrap_or("image/jpeg");
    let b64 = general_purpose::STANDARD.encode(pic.data());
    Ok(Some(format!("data:{};base64,{}", mime, b64)))
}

#[derive(Serialize, Clone, Copy)]
pub struct Palette {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

pub fn cover_palette(source: &str) -> Result<Palette, String> {
    let bytes = if let Some(rest) = source.strip_prefix("data:") {
        let comma = rest.find(',').ok_or_else(|| "malformed data url".to_string())?;
        let meta = &rest[..comma];
        let payload = &rest[comma + 1..];
        if meta.contains(";base64") {
            general_purpose::STANDARD
                .decode(payload)
                .map_err(|e| format!("decode base64: {e}"))?
        } else {
            payload.as_bytes().to_vec()
        }
    } else if source.starts_with("http://") || source.starts_with("https://") {
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(8))
            .user_agent("Mozilla/5.0 Musicmate/0.1")
            .build()
            .map_err(|e| format!("http client: {e}"))?;
        client
            .get(source)
            .send()
            .and_then(|r| r.error_for_status())
            .map_err(|e| format!("fetch cover: {e}"))?
            .bytes()
            .map_err(|e| format!("read cover: {e}"))?
            .to_vec()
    } else {
        std::fs::read(source).map_err(|e| format!("read cover file: {e}"))?
    };

    let img = image::load_from_memory(&bytes)
        .map_err(|e| format!("decode image: {e}"))?
        .resize_exact(32, 32, FilterType::Triangle)
        .into_rgba8();

    let mut best = (0u8, 0u8, 0u8);
    let mut best_score = -1.0f32;
    let mut sum_r = 0.0f32;
    let mut sum_g = 0.0f32;
    let mut sum_b = 0.0f32;
    let mut sum_w = 0.0f32;

    for (_, _, p) in img.enumerate_pixels() {
        let [r, g, b, a] = p.0;
        if a < 200 {
            continue;
        }
        let rf = r as f32;
        let gf = g as f32;
        let bf = b as f32;
        let max = rf.max(gf).max(bf);
        let min = rf.min(gf).min(bf);
        let sat = if max == 0.0 { 0.0 } else { (max - min) / max };
        let brightness = max / 255.0;
        let score = sat * 1.4 + brightness * 0.6;
        if score > best_score {
            best_score = score;
            best = (r, g, b);
        }
        let w = sat + 0.2;
        sum_r += rf * w;
        sum_g += gf * w;
        sum_b += bf * w;
        sum_w += w;
    }

    if sum_w <= 0.0 {
        return Ok(Palette { r: 250, g: 45, b: 72 });
    }

    let avg_r = sum_r / sum_w;
    let avg_g = sum_g / sum_w;
    let avg_b = sum_b / sum_w;
    let mut final_r = best.0 as f32 * 0.6 + avg_r * 0.4;
    let mut final_g = best.1 as f32 * 0.6 + avg_g * 0.4;
    let mut final_b = best.2 as f32 * 0.6 + avg_b * 0.4;

    let max = final_r.max(final_g).max(final_b);
    if max > 0.0 && max < 180.0 {
        let scale = 200.0 / max;
        final_r *= scale;
        final_g *= scale;
        final_b *= scale;
    }

    Ok(Palette {
        r: final_r.clamp(0.0, 255.0).round() as u8,
        g: final_g.clamp(0.0, 255.0).round() as u8,
        b: final_b.clamp(0.0, 255.0).round() as u8,
    })
}

pub fn get_lyrics(path: &Path) -> Result<Lyrics, String> {
    if !path.exists() {
        return Err(format!("media file does not exist: {}", path.display()));
    }
    if let Some(raw) = read_external_lrc(path) {
        let synced = parse_lrc(&raw);
        return Ok(Lyrics {
            source: "lrc-file".to_string(),
            raw,
            synced,
        });
    }
    if let Some(raw) = read_embedded_lyrics(path) {
        let synced = parse_lrc(&raw);
        return Ok(Lyrics {
            source: "embedded".to_string(),
            raw,
            synced,
        });
    }
    Ok(Lyrics::default())
}

fn read_external_lrc(audio_path: &Path) -> Option<String> {
    let lrc_path = audio_path.with_extension("lrc");
    let bytes = std::fs::read(&lrc_path).ok()?;
    decode_text(&bytes)
}

fn decode_text(bytes: &[u8]) -> Option<String> {
    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return Some(String::from_utf8_lossy(&bytes[3..]).into_owned());
    }
    Some(String::from_utf8_lossy(bytes).into_owned())
}

fn read_embedded_lyrics(path: &Path) -> Option<String> {
    let tagged = Probe::open(path).ok()?.read().ok()?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag())?;
    if let Some(s) = tag.get_string(&ItemKey::Lyrics) {
        if !s.trim().is_empty() {
            return Some(s.to_string());
        }
    }
    if let Some(s) = tag.comment() {
        if s.contains('[') && s.contains(']') {
            return Some(s.to_string());
        }
    }
    None
}

fn parse_lrc(text: &str) -> Vec<LyricLine> {
    let mut out: Vec<LyricLine> = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim_end_matches(['\r', '\n']);
        if trimmed.is_empty() {
            continue;
        }
        let (timestamps, content) = extract_timestamps(trimmed);
        if timestamps.is_empty() {
            continue;
        }
        let content = content.trim().to_string();
        for t in timestamps {
            out.push(LyricLine {
                time_ms: t,
                text: content.clone(),
            });
        }
    }
    out.sort_by_key(|l| l.time_ms);
    out
}

fn extract_timestamps(line: &str) -> (Vec<u64>, &str) {
    let mut timestamps = Vec::new();
    let mut rest = line;
    loop {
        let bytes = rest.as_bytes();
        if bytes.first() != Some(&b'[') {
            break;
        }
        let end = match rest.find(']') {
            Some(i) => i,
            None => break,
        };
        let inside = &rest[1..end];
        match parse_lrc_time(inside) {
            Some(ms) => {
                timestamps.push(ms);
                rest = &rest[end + 1..];
            }
            None => {
                return (Vec::new(), rest);
            }
        }
    }
    (timestamps, rest)
}

fn parse_lrc_time(s: &str) -> Option<u64> {
    let (m, rest) = s.split_once(':')?;
    let minutes: u64 = m.parse().ok()?;
    let (sec_part, frac_part) = match rest.split_once('.') {
        Some((s, f)) => (s, f),
        None => (rest, ""),
    };
    let seconds: u64 = sec_part.parse().ok()?;
    let frac_ms: u64 = if frac_part.is_empty() {
        0
    } else {
        let frac: u64 = frac_part.chars().take(3).collect::<String>().parse().ok()?;
        match frac_part.len() {
            1 => frac * 100,
            2 => frac * 10,
            _ => frac,
        }
    };
    Some(minutes * 60_000 + seconds * 1000 + frac_ms)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_multiple_lrc_timestamps() {
        let parsed = parse_lrc("[00:01.20][00:03.50]line");
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].time_ms, 1200);
        assert_eq!(parsed[1].time_ms, 3500);
        assert_eq!(parsed[0].text, "line");
    }

    #[test]
    fn ignores_non_timestamp_lines() {
        let parsed = parse_lrc("[ar:test]\nplain text\n[00:10.00]hello");
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].time_ms, 10_000);
    }
}
