use std::collections::HashSet;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::media::{LyricLine, Lyrics};

fn http_client() -> &'static reqwest::blocking::Client {
    static CLIENT: OnceLock<reqwest::blocking::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(12))
            .build()
            .expect("http client init failed")
    })
}

#[derive(Debug, Clone, Serialize)]
pub struct OnlineTrackContext {
    pub provider: String,
    pub provider_id: Option<String>,
    pub comment_id: Option<String>,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub cover_url: Option<String>,
    pub play_url: Option<String>,
    pub duration_secs: Option<u32>,
    pub comments: Vec<String>,
}

#[derive(Debug, Clone)]
struct QqSongCandidate {
    id: u64,
    mid: String,
    title: String,
    artist: String,
    album: String,
    album_mid: Option<String>,
    singer_mid: Option<String>,
    duration_secs: Option<u32>,
}

pub fn fetch_context(query: &str) -> Result<OnlineTrackContext, String> {
    if std::env::var("MUSICMATE_QQ_API_BASE").is_ok()
        || std::env::var("MUSICMATE_NETEASE_API_BASE").is_err()
    {
        match fetch_qq_context(query) {
            Ok(context) => return Ok(context),
            Err(qq_err) => {
                if std::env::var("MUSICMATE_NETEASE_API_BASE").is_ok() {
                    return fetch_netease_context(query).map_err(|netease_err| {
                        format!("QQ failed: {qq_err}; NetEase failed: {netease_err}")
                    });
                }
                return Err(format!("QQ failed: {qq_err}. {}", qq_api_setup_hint()));
            }
        }
    }
    fetch_netease_context(query)
}

pub fn search_contexts(
    query: &str,
    limit: usize,
    include_play_url: bool,
) -> Result<Vec<OnlineTrackContext>, String> {
    if std::env::var("MUSICMATE_QQ_API_BASE").is_ok()
        || std::env::var("MUSICMATE_NETEASE_API_BASE").is_err()
    {
        match search_qq_contexts(query, limit, include_play_url) {
            Ok(contexts) if !contexts.is_empty() => return Ok(contexts),
            Ok(_) => {}
            Err(qq_err) => {
                if std::env::var("MUSICMATE_NETEASE_API_BASE").is_err() {
                    return Err(format!("QQ failed: {qq_err}. {}", qq_api_setup_hint()));
                }
            }
        }
    }
    fetch_netease_context(query).map(|context| vec![context])
}

pub fn qq_hot_queries(limit: usize) -> Result<Vec<String>, String> {
    let base = std::env::var("MUSICMATE_QQ_API_BASE")
        .unwrap_or_else(|_| "http://127.0.0.1:3200".to_string());
    let base = base.trim_end_matches('/');
    let client = http_client();
    let payload: Value = client
        .get(format!("{base}/getRanks"))
        .query(&[("topId", "4"), ("limit", &limit.to_string()), ("page", "0")])
        .send()
        .map_err(|e| format!("qq ranks request: {e}"))?
        .error_for_status()
        .map_err(|e| format!("qq ranks status: {e}"))?
        .json()
        .map_err(|e| format!("decode qq ranks: {e}"))?;
    let songs = payload
        .get("response")
        .and_then(|value| value.get("req_1"))
        .and_then(|value| value.get("data"))
        .and_then(|value| value.get("data"))
        .and_then(|value| value.get("song"))
        .and_then(|value| value.as_array())
        .ok_or_else(|| "QQ ranks response did not include songs".to_string())?;
    Ok(songs
        .iter()
        .filter_map(|song| {
            let title = first_str(song, &["title", "name"])?;
            let artist = first_str(song, &["singerName", "singer"])?;
            Some(format!("{title} {artist}"))
        })
        .take(limit)
        .collect())
}

pub fn fetch_qq_context(query: &str) -> Result<OnlineTrackContext, String> {
    search_qq_contexts(query, 1, true)?
        .into_iter()
        .next()
        .ok_or_else(|| format!("no QQ Music match for {query}"))
}

pub fn search_qq_contexts(
    query: &str,
    limit: usize,
    include_play_url: bool,
) -> Result<Vec<OnlineTrackContext>, String> {
    let query = normalize_qq_query(query);
    let base = std::env::var("MUSICMATE_QQ_API_BASE")
        .unwrap_or_else(|_| "http://127.0.0.1:3200".to_string());
    let base = base.trim_end_matches('/');
    let client = http_client();

    let target = limit.max(1);
    let per_page = target.clamp(10, 60);
    let max_pages = target.div_ceil(per_page).max(1).min(8);
    let mut search_error = None;
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();
    for page in 1..=max_pages {
        match qq_search(&client, base, &query, per_page, page) {
            Ok(search) => {
                let items = qq_song_list(&search)
                    .filter(|items| !items.is_empty())
                    .or_else(|| {
                        find_first_array(&search, &["list"]).filter(|items| !items.is_empty())
                    });
                if let Some(items) = items {
                    for candidate in items.iter().filter_map(parse_qq_candidate) {
                        if seen.insert(candidate.mid.clone()) {
                            candidates.push(candidate);
                        }
                        if candidates.len() >= target {
                            break;
                        }
                    }
                }
            }
            Err(err) => {
                if search_error.is_none() {
                    search_error = Some(err);
                }
            }
        }
        if candidates.len() >= target {
            break;
        }
    }
    if candidates.len() < target {
        for expanded_query in expanded_qq_queries(&query) {
            if candidates.len() >= target {
                break;
            }
            let Ok(search) = qq_search(&client, base, &expanded_query, per_page, 1) else {
                continue;
            };
            let Some(items) = qq_song_list(&search)
                .filter(|items| !items.is_empty())
                .or_else(|| find_first_array(&search, &["list"]).filter(|items| !items.is_empty()))
            else {
                continue;
            };
            for candidate in items.iter().filter_map(parse_qq_candidate) {
                if seen.insert(candidate.mid.clone()) {
                    candidates.push(candidate);
                }
                if candidates.len() >= target {
                    break;
                }
            }
        }
    }
    let mut candidates = if candidates.is_empty() {
        qq_smartbox(&client, base, &query)
            .ok()
            .and_then(|value| {
                qq_smartbox_song_list(&value)
                    .map(|items| items.iter().filter_map(parse_qq_candidate).collect::<Vec<_>>())
            })
            .ok_or_else(|| match search_error {
                Some(err) => format!(
                    "no QQ Music match for {query}; getSearchByKey failed ({err}), and getSmartbox returned no song"
                ),
                None => format!(
                    "no QQ Music match for {query}; getSearchByKey returned empty, and getSmartbox returned no song"
                ),
            })?
    } else {
        candidates
    };
    candidates.truncate(target);

    let mut contexts = Vec::new();
    for mut candidate in candidates {
        if candidate.album_mid.is_none() {
            if let Ok(Some((album, album_mid))) = fetch_qq_album_info(&client, base, &candidate.mid)
            {
                if candidate.album.is_empty() {
                    candidate.album = album;
                }
                candidate.album_mid = Some(album_mid);
            }
        }
        let play_url = if include_play_url {
            fetch_qq_play_url(&client, base, &candidate.mid)
                .ok()
                .flatten()
        } else {
            None
        };
        contexts.push(OnlineTrackContext {
            provider: "QQ Music".to_string(),
            provider_id: Some(candidate.mid),
            comment_id: Some(candidate.id.to_string()),
            title: candidate.title,
            artist: candidate.artist,
            album: candidate.album,
            cover_url: candidate
                .album_mid
                .as_ref()
                .map(|album_mid| {
                    format!("https://y.gtimg.cn/music/photo_new/T002R300x300M000{album_mid}.jpg")
                })
                .or_else(|| {
                    candidate.singer_mid.as_ref().map(|singer_mid| {
                        format!(
                            "https://y.gtimg.cn/music/photo_new/T001R300x300M000{singer_mid}.jpg"
                        )
                    })
                }),
            play_url,
            duration_secs: candidate.duration_secs,
            comments: Vec::new(),
        });
    }
    Ok(contexts)
}

pub fn resolve_play_url(provider: &str, provider_id: &str) -> Result<String, String> {
    if !provider.eq_ignore_ascii_case("QQ Music") {
        return Err(format!("unsupported online provider: {provider}"));
    }
    let base = std::env::var("MUSICMATE_QQ_API_BASE")
        .unwrap_or_else(|_| "http://127.0.0.1:3200".to_string());
    let base = base.trim_end_matches('/');
    let client = http_client();
    fetch_qq_play_url(client, base, provider_id)?
        .ok_or_else(|| "QQ Music did not return a playable URL".to_string())
}

fn expanded_qq_queries(query: &str) -> Vec<String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    ["歌曲", "热门", "经典", "专辑", "现场", "翻唱"]
        .iter()
        .map(|suffix| format!("{trimmed} {suffix}"))
        .collect()
}

fn normalize_qq_query(query: &str) -> String {
    let mut out = String::with_capacity(query.len());
    let mut last_was_space = false;
    for ch in query.chars() {
        let normalized = match ch {
            '_' | '-' | '—' | '–' | '·' | '|' | '/' | '\\' => ' ',
            _ => ch,
        };
        if normalized.is_whitespace() {
            if !last_was_space {
                out.push(' ');
                last_was_space = true;
            }
        } else {
            out.push(normalized);
            last_was_space = false;
        }
    }
    out.trim().to_string()
}

pub fn fetch_comments(
    provider: &str,
    comment_id: &str,
    limit: usize,
) -> Result<Vec<String>, String> {
    if !provider.eq_ignore_ascii_case("QQ Music") {
        return Ok(Vec::new());
    }
    let id = comment_id
        .parse::<u64>()
        .map_err(|e| format!("invalid QQ comment id: {e}"))?;
    let base = std::env::var("MUSICMATE_QQ_API_BASE")
        .unwrap_or_else(|_| "http://127.0.0.1:3200".to_string());
    let base = base.trim_end_matches('/');
    let client = http_client();
    fetch_qq_comments_by_id(client, base, id, limit)
}

fn qq_api_setup_hint() -> &'static str {
    #[cfg(windows)]
    {
        "请先启动 qq-music-api（默认 http://127.0.0.1:3200），或在「设置 > QQ 音乐 > 服务地址」填写可用服务地址。"
    }
    #[cfg(not(windows))]
    {
        "Start qq-music-api or run ./scripts/start-all.sh."
    }
}

fn fetch_qq_comments_by_id(
    client: &reqwest::blocking::Client,
    base: &str,
    id: u64,
    limit: usize,
) -> Result<Vec<String>, String> {
    let payload: Value = client
        .get(format!("{base}/getComments"))
        .query(&[
            ("id", id.to_string()),
            ("pagesize", limit.max(1).to_string()),
        ])
        .send()
        .map_err(|e| format!("qq comments request: {e}"))?
        .error_for_status()
        .map_err(|e| format!("qq comments status: {e}"))?
        .json()
        .map_err(|e| format!("decode qq comments: {e}"))?;
    Ok(collect_comments(&payload, limit))
}

fn qq_search(
    client: &reqwest::blocking::Client,
    base: &str,
    query: &str,
    limit: usize,
    page: usize,
) -> Result<Value, String> {
    let limit_str = limit.clamp(1, 60).to_string();
    let page_str = page.max(1).to_string();
    client
        .get(format!("{base}/getSearchByKey"))
        .query(&[("key", query), ("limit", &limit_str), ("page", &page_str)])
        .send()
        .map_err(|e| format!("qq search request: {e}"))?
        .error_for_status()
        .map_err(|e| format!("qq search status: {e}"))?
        .json()
        .map_err(|e| format!("decode qq search: {e}"))
}

fn fetch_qq_play_url(
    client: &reqwest::blocking::Client,
    base: &str,
    song_mid: &str,
) -> Result<Option<String>, String> {
    let play_payload: Value = client
        .get(format!("{base}/getMusicPlay"))
        .query(&[
            ("songmid", song_mid.to_string()),
            ("resType", "all".to_string()),
            ("quality", "128".to_string()),
        ])
        .send()
        .map_err(|e| format!("qq play url request: {e}"))?
        .error_for_status()
        .map_err(|e| format!("qq play url status: {e}"))?
        .json()
        .map_err(|e| format!("decode qq play url: {e}"))?;
    Ok(find_qq_play_url(&play_payload, song_mid))
}

fn fetch_qq_album_info(
    client: &reqwest::blocking::Client,
    base: &str,
    song_mid: &str,
) -> Result<Option<(String, String)>, String> {
    let payload: Value = client
        .get(format!("{base}/getSongInfo"))
        .query(&[("songmid", song_mid)])
        .send()
        .map_err(|e| format!("qq song info request: {e}"))?
        .error_for_status()
        .map_err(|e| format!("qq song info status: {e}"))?
        .json()
        .map_err(|e| format!("decode qq song info: {e}"))?;
    let album = payload
        .get("response")
        .and_then(|value| value.get("songinfo"))
        .and_then(|value| value.get("data"))
        .and_then(|value| value.get("track_info"))
        .and_then(|value| value.get("album"));
    let Some(album) = album else {
        return Ok(None);
    };
    let album_mid = first_str(album, &["mid", "pmid"])
        .map(str::to_string)
        .filter(|value| !value.is_empty());
    let album_name = first_str(album, &["name", "title"])
        .unwrap_or("")
        .to_string();
    Ok(album_mid.map(|mid| (album_name, mid)))
}

fn parse_qq_candidate(value: &Value) -> Option<QqSongCandidate> {
    let id = first_u64(value, &["songid", "id", "docid"])?;
    let mid = first_str(value, &["songmid", "mid"])?.to_string();
    let title = first_str(value, &["songname", "name", "title"])
        .unwrap_or("Unknown Title")
        .to_string();
    let artist = first_str(value, &["singer"])
        .map(str::to_string)
        .or_else(|| {
            value
                .get("singer")
                .and_then(|value| value.as_array())
                .and_then(|items| items.first())
                .and_then(|value| first_str(value, &["name", "singername"]))
                .map(str::to_string)
        })
        .unwrap_or_else(|| "Unknown Artist".to_string());
    let album = first_str(value, &["albumname", "album"])
        .unwrap_or("")
        .to_string();
    let album_mid = first_str(value, &["albummid", "album_mid"])
        .map(str::to_string)
        .or_else(|| {
            value
                .get("album")
                .and_then(|value| first_str(value, &["mid", "pmid"]))
                .map(str::to_string)
        })
        .filter(|s| !s.is_empty());
    let singer_mid = value
        .get("singer")
        .and_then(|value| value.as_array())
        .and_then(|items| items.first())
        .and_then(|value| first_str(value, &["mid", "singermid"]))
        .map(str::to_string)
        .filter(|s| !s.is_empty());
    let duration_secs = value
        .get("interval")
        .and_then(|v| v.as_u64())
        .map(|s| s as u32)
        .filter(|s| *s > 0);
    Some(QqSongCandidate {
        id,
        mid,
        title,
        artist,
        album,
        album_mid,
        singer_mid,
        duration_secs,
    })
}

fn qq_smartbox(
    client: &reqwest::blocking::Client,
    base: &str,
    query: &str,
) -> Result<Value, String> {
    client
        .get(format!("{base}/getSmartbox"))
        .query(&[("key", query)])
        .send()
        .map_err(|e| format!("qq smartbox request: {e}"))?
        .error_for_status()
        .map_err(|e| format!("qq smartbox status: {e}"))?
        .json()
        .map_err(|e| format!("decode qq smartbox: {e}"))
}

pub fn fetch_netease_context(query: &str) -> Result<OnlineTrackContext, String> {
    let base = std::env::var("MUSICMATE_NETEASE_API_BASE")
        .map_err(|_| "MUSICMATE_NETEASE_API_BASE is not set".to_string())?;
    let base = base.trim_end_matches('/');
    let client = http_client();

    let search: SearchResponse = client
        .get(format!("{base}/search"))
        .query(&[("keywords", query), ("type", "1"), ("limit", "1")])
        .send()
        .map_err(|e| format!("search request: {e}"))?
        .error_for_status()
        .map_err(|e| format!("search status: {e}"))?
        .json()
        .map_err(|e| format!("decode search: {e}"))?;

    let song = search
        .result
        .and_then(|result| result.songs.into_iter().next())
        .ok_or_else(|| format!("no online match for {query}"))?;

    let comments: CommentResponse = client
        .get(format!("{base}/comment/music"))
        .query(&[("id", song.id.to_string()), ("limit", "8".to_string())])
        .send()
        .map_err(|e| format!("comment request: {e}"))?
        .error_for_status()
        .map_err(|e| format!("comment status: {e}"))?
        .json()
        .map_err(|e| format!("decode comments: {e}"))?;

    let artist = song
        .artists
        .first()
        .map(|artist| artist.name.clone())
        .unwrap_or_else(|| "Unknown Artist".to_string());
    let album = song.album.map(|album| album.name).unwrap_or_default();
    let comments = comments
        .hot_comments
        .into_iter()
        .chain(comments.comments)
        .filter_map(|comment| {
            let text = comment.content.trim();
            (!text.is_empty()).then(|| text.to_string())
        })
        .take(8)
        .collect();

    Ok(OnlineTrackContext {
        provider: "NetEase".to_string(),
        provider_id: Some(song.id.to_string()),
        comment_id: Some(song.id.to_string()),
        title: song.name,
        artist,
        album,
        cover_url: None,
        play_url: None,
        duration_secs: None,
        comments,
    })
}

pub fn fetch_lyrics(provider: &str, provider_id: &str) -> Result<Lyrics, String> {
    match provider {
        "QQ Music" => fetch_qq_lyrics(provider_id),
        _ => Err(format!("lyrics are not supported for provider {provider}")),
    }
}

fn fetch_qq_lyrics(song_mid: &str) -> Result<Lyrics, String> {
    let base = std::env::var("MUSICMATE_QQ_API_BASE")
        .unwrap_or_else(|_| "http://127.0.0.1:3200".to_string());
    let base = base.trim_end_matches('/');
    let client = http_client();
    let payload: Value = client
        .get(format!("{base}/getLyric"))
        .query(&[("songmid", song_mid), ("isFormat", "true")])
        .send()
        .map_err(|e| format!("qq lyric request: {e}"))?
        .error_for_status()
        .map_err(|e| format!("qq lyric status: {e}"))?
        .json()
        .map_err(|e| format!("decode qq lyric: {e}"))?;

    let raw = find_lyric_text(&payload)
        .ok_or_else(|| "QQ lyric response did not include lyric text".to_string())?;
    let synced = parse_lrc_public(&raw);
    Ok(Lyrics {
        source: "qq-music".to_string(),
        raw,
        synced,
    })
}

fn find_lyric_text(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => {
            let trimmed = text.trim();
            if trimmed.contains("[00:") || trimmed.lines().count() > 1 {
                Some(text.to_string())
            } else {
                None
            }
        }
        Value::Array(items) => items.iter().find_map(find_lyric_text),
        Value::Object(object) => {
            for key in ["lyric", "trans", "content"] {
                if let Some(text) = object.get(key).and_then(|value| value.as_str()) {
                    if !text.trim().is_empty() {
                        return Some(text.to_string());
                    }
                }
            }
            object.values().find_map(find_lyric_text)
        }
        _ => None,
    }
}

fn parse_lrc_public(text: &str) -> Vec<LyricLine> {
    let mut out = Vec::new();
    for line in text.lines() {
        let (timestamps, content) = extract_timestamps(line);
        for time_ms in timestamps {
            out.push(LyricLine {
                time_ms,
                text: content.trim().to_string(),
            });
        }
    }
    out.sort_by_key(|line| line.time_ms);
    out
}

fn extract_timestamps(line: &str) -> (Vec<u64>, &str) {
    let mut timestamps = Vec::new();
    let mut rest = line;
    loop {
        if !rest.starts_with('[') {
            break;
        }
        let Some(end) = rest.find(']') else {
            break;
        };
        let inside = &rest[1..end];
        if let Some(ms) = parse_lrc_time(inside) {
            timestamps.push(ms);
            rest = &rest[end + 1..];
        } else {
            return (Vec::new(), rest);
        }
    }
    (timestamps, rest)
}

fn parse_lrc_time(value: &str) -> Option<u64> {
    let (minutes, rest) = value.split_once(':')?;
    let minutes: u64 = minutes.parse().ok()?;
    let (seconds, frac) = rest.split_once('.').unwrap_or((rest, ""));
    let seconds: u64 = seconds.parse().ok()?;
    let millis = if frac.is_empty() {
        0
    } else {
        let value: u64 = frac.chars().take(3).collect::<String>().parse().ok()?;
        match frac.len() {
            1 => value * 100,
            2 => value * 10,
            _ => value,
        }
    };
    Some(minutes * 60_000 + seconds * 1000 + millis)
}

fn find_qq_play_url(value: &Value, song_mid: &str) -> Option<String> {
    value
        .get("data")
        .and_then(|value| value.get("playUrl"))
        .and_then(|value| value.get(song_mid))
        .and_then(|value| value.get("url"))
        .and_then(|value| value.as_str())
        .filter(|url| !url.trim().is_empty())
        .map(str::to_string)
        .or_else(|| find_qq_testfile_url(value))
}

fn find_qq_testfile_url(value: &Value) -> Option<String> {
    let data = value
        .get("data")
        .and_then(|value| value.get("req_0"))
        .and_then(|value| value.get("data"))?;
    let domain = data
        .get("sip")
        .and_then(|value| value.as_array())
        .and_then(|items| {
            items
                .iter()
                .filter_map(|value| value.as_str())
                .find(|url| url.starts_with("http://") || url.starts_with("https://"))
        })?;
    for key in ["testfilewifi", "testfile2g"] {
        if let Some(path) = data.get(key).and_then(|value| value.as_str()) {
            if !path.trim().is_empty() {
                return Some(format!("{domain}{path}"));
            }
        }
    }
    None
}

fn first_str<'a>(value: &'a Value, keys: &[&str]) -> Option<&'a str> {
    keys.iter().find_map(|key| value.get(*key)?.as_str())
}

fn first_u64(value: &Value, keys: &[&str]) -> Option<u64> {
    keys.iter().find_map(|key| {
        let value = value.get(*key)?;
        value
            .as_u64()
            .or_else(|| value.as_str().and_then(|text| text.parse().ok()))
    })
}

fn find_first_array<'a>(value: &'a Value, keys: &[&str]) -> Option<&'a Vec<Value>> {
    if let Some(array) = value.as_array() {
        return Some(array);
    }
    if let Some(object) = value.as_object() {
        for key in keys {
            if let Some(array) = object.get(*key).and_then(|value| value.as_array()) {
                return Some(array);
            }
        }
        for child in object.values() {
            if let Some(array) = find_first_array(child, keys) {
                return Some(array);
            }
        }
    }
    None
}

fn qq_song_list(value: &Value) -> Option<&Vec<Value>> {
    value
        .get("response")
        .and_then(|value| value.get("data"))
        .and_then(|value| value.get("song"))
        .and_then(|value| value.get("list"))
        .and_then(|value| value.as_array())
}

fn qq_smartbox_song_list(value: &Value) -> Option<&Vec<Value>> {
    value
        .get("response")
        .and_then(|value| value.get("data"))
        .and_then(|value| value.get("song"))
        .and_then(|value| value.get("itemlist"))
        .and_then(|value| value.as_array())
}

fn collect_comments(value: &Value, limit: usize) -> Vec<String> {
    let mut out = Vec::new();
    collect_comments_inner(value, &mut out, limit);
    out
}

fn collect_comments_inner(value: &Value, out: &mut Vec<String>, limit: usize) {
    if out.len() >= limit {
        return;
    }
    match value {
        Value::Array(items) => {
            for item in items {
                collect_comments_inner(item, out, limit);
                if out.len() >= limit {
                    return;
                }
            }
        }
        Value::Object(object) => {
            for key in [
                "rootcommentcontent",
                "middlecommentcontent",
                "content",
                "comment",
            ] {
                if let Some(text) = object.get(key).and_then(|value| value.as_str()) {
                    let text = text.trim();
                    if !text.is_empty() && !out.iter().any(|item| item == text) {
                        out.push(text.to_string());
                        if out.len() >= limit {
                            return;
                        }
                    }
                }
            }
            for child in object.values() {
                collect_comments_inner(child, out, limit);
                if out.len() >= limit {
                    return;
                }
            }
        }
        _ => {}
    }
}

#[derive(Debug, Deserialize)]
struct SearchResponse {
    result: Option<SearchResult>,
}

#[derive(Debug, Deserialize)]
struct SearchResult {
    #[serde(default)]
    songs: Vec<SearchSong>,
}

#[derive(Debug, Deserialize)]
struct SearchSong {
    id: u64,
    name: String,
    #[serde(default, alias = "artists", alias = "ar")]
    artists: Vec<SearchArtist>,
    #[serde(default, alias = "album", alias = "al")]
    album: Option<SearchAlbum>,
}

#[derive(Debug, Deserialize)]
struct SearchArtist {
    name: String,
}

#[derive(Debug, Deserialize)]
struct SearchAlbum {
    name: String,
}

#[derive(Debug, Deserialize)]
struct CommentResponse {
    #[serde(default, rename = "hotComments")]
    hot_comments: Vec<Comment>,
    #[serde(default)]
    comments: Vec<Comment>,
}

#[derive(Debug, Deserialize)]
struct Comment {
    content: String,
}
