use msedge_tts::tts::client::connect;
use msedge_tts::tts::SpeechConfig;
use msedge_tts::voice::get_voices_list;

pub const DEFAULT_VOICE: &str = "XiaoxiaoNeural";

pub fn synthesize(text: &str, voice_short_name: &str) -> Result<Vec<u8>, String> {
    let voices = get_voices_list().map_err(|e| format!("voice list: {e}"))?;
    let voice = voices
        .iter()
        .find(|v| v.name.contains(voice_short_name))
        .ok_or_else(|| format!("voice '{voice_short_name}' not found"))?;
    let config = SpeechConfig::from(voice);
    let mut client = connect().map_err(|e| format!("tts connect: {e}"))?;
    let audio = client
        .synthesize(text, &config)
        .map_err(|e| format!("tts synth: {e}"))?;
    Ok(audio.audio_bytes)
}
