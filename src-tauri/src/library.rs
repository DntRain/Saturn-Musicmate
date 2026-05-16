use std::path::Path;

use lofty::file::{AudioFile, TaggedFileExt};
use lofty::probe::Probe;
use lofty::tag::Accessor;
use serde::Serialize;
use walkdir::WalkDir;

#[derive(Serialize, Clone, Debug)]
pub struct Track {
    pub path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_secs: Option<u64>,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub provider_id: Option<String>,
    #[serde(default)]
    pub cover_url: Option<String>,
}

const AUDIO_EXTS: &[&str] = &["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus"];

pub fn scan(folder: &Path) -> Result<Vec<Track>, String> {
    if !folder.exists() {
        return Err(format!("folder does not exist: {}", folder.display()));
    }
    if !folder.is_dir() {
        return Err(format!("path is not a directory: {}", folder.display()));
    }

    let mut out = Vec::new();
    for entry in WalkDir::new(folder).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = match path.extension().and_then(|e| e.to_str()) {
            Some(e) => e.to_lowercase(),
            None => continue,
        };
        if !AUDIO_EXTS.contains(&ext.as_str()) {
            continue;
        }
        out.push(read_metadata(path));
    }
    out.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    Ok(out)
}

fn read_metadata(path: &Path) -> Track {
    let path_str = path.to_string_lossy().to_string();
    let fallback_title = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown")
        .to_string();

    match Probe::open(path).and_then(|p| p.read()) {
        Ok(tagged) => {
            let tag = tagged.primary_tag().or_else(|| tagged.first_tag());
            let title = tag
                .and_then(|t| t.title().map(|s| s.to_string()))
                .unwrap_or(fallback_title);
            let artist = tag
                .and_then(|t| t.artist().map(|s| s.to_string()))
                .unwrap_or_else(|| "Unknown Artist".to_string());
            let album = tag
                .and_then(|t| t.album().map(|s| s.to_string()))
                .unwrap_or_default();
            let duration_secs = Some(tagged.properties().duration().as_secs());
            Track {
                path: path_str,
                title,
                artist,
                album,
                duration_secs,
                provider: None,
                provider_id: None,
                cover_url: None,
            }
        }
        Err(_) => Track {
            path: path_str,
            title: fallback_title,
            artist: "Unknown Artist".to_string(),
            album: String::new(),
            duration_secs: None,
            provider: None,
            provider_id: None,
            cover_url: None,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scan_rejects_missing_directory() {
        let err = scan(Path::new("/definitely/missing/musicmate-test-path")).unwrap_err();
        assert!(err.contains("folder does not exist"));
    }
}
