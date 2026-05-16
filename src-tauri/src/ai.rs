use serde::{Deserialize, Serialize};
use tauri::AppHandle;

const API_BASE_URL: &str = "https://api.deepseek.com";
const MAX_SPOKEN_CONTEXT: usize = 5;
const MAX_RECENT_TRACKS_CONTEXT: usize = 5;

#[derive(Debug, Clone, Deserialize)]
pub struct HostContext {
    pub persona: Persona,
    pub current_title: Option<String>,
    pub current_artist: Option<String>,
    pub current_album: Option<String>,
    pub previous_title: Option<String>,
    pub previous_artist: Option<String>,
    pub hour: u8,
    pub minute: u8,
    pub spoken_lines: Vec<String>,
    pub recent_tracks: Vec<PlayedTrack>,
    pub session_gap_hours: Option<f64>,
    pub total_sessions: u32,
    pub trigger: Trigger,
    #[serde(default)]
    pub available_playlists: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Persona {
    pub name: String,
    pub style: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PlayedTrack {
    pub title: String,
    pub artist: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Trigger {
    Welcome,
    Transition,
    Hourly,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HostActionKind {
    Chat,
    SearchSong,
    PlayChart,
    ExplainCurrent,
    AddToQueue,
    PlayNext,
    CreatePlaylist,
    AddToPlaylist,
}

#[derive(Debug, Clone, Deserialize)]
pub struct HostAction {
    pub action: HostActionKind,
    pub query: Option<String>,
    #[serde(default)]
    pub queries: Vec<String>,
    pub chart: Option<String>,
    pub reply: String,
    #[serde(default)]
    pub playlist_name: Option<String>,
}

#[derive(Serialize)]
struct MessageRequest<'a> {
    model: &'a str,
    max_tokens: u16,
    messages: Vec<MessagePayload>,
    thinking: ThinkingConfig,
}

#[derive(Serialize)]
struct MessagePayload {
    role: &'static str,
    content: String,
}

#[derive(Serialize)]
struct ThinkingConfig {
    #[serde(rename = "type")]
    kind: &'static str,
}

#[derive(Deserialize)]
struct MessageResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ChoiceMessage,
}

#[derive(Deserialize)]
struct ChoiceMessage {
    content: String,
}

pub fn generate_line(app: Option<&AppHandle>, ctx: &HostContext) -> Result<String, String> {
    let api_key = crate::settings::deepseek_api_key(app)?;
    let model = crate::settings::deepseek_model(app);

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("http client: {e}"))?;

    let request = MessageRequest {
        model: &model,
        max_tokens: 350,
        messages: vec![
            MessagePayload {
                role: "system",
                content: build_system_prompt(&ctx.persona),
            },
            MessagePayload {
                role: "user",
                content: build_user_prompt(ctx),
            },
        ],
        thinking: ThinkingConfig { kind: "disabled" },
    };

    let response = client
        .post(format!("{API_BASE_URL}/chat/completions"))
        .bearer_auth(api_key)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&request)
        .send()
        .map_err(|e| format!("request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let body = response
            .text()
            .unwrap_or_else(|_| "<unavailable>".to_string());
        return Err(format!("model request failed ({status}): {body}"));
    }

    let payload: MessageResponse = response
        .json()
        .map_err(|e| format!("decode response: {e}"))?;

    payload
        .choices
        .into_iter()
        .next()
        .map(|choice| choice.message.content)
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
        .ok_or_else(|| "model returned empty text".to_string())
}

pub fn chat_reply(app: Option<&AppHandle>, message: &str, ctx: &HostContext) -> Result<String, String> {
    let api_key = crate::settings::deepseek_api_key(app)?;
    let model = crate::settings::deepseek_model(app);
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("http client: {e}"))?;
    let request = MessageRequest {
        model: &model,
        max_tokens: 500,
        messages: vec![
            MessagePayload {
                role: "system",
                content: build_system_prompt(&ctx.persona),
            },
            MessagePayload {
                role: "user",
                content: format!(
                    "{}\n\n用户刚刚对你说：{}\n\n请自然回应。如果用户要求推荐或播放热门歌曲，先说明你会为他找一组当下热门歌，并简短铺垫。",
                    build_user_prompt(ctx),
                    message
                ),
            },
        ],
        thinking: ThinkingConfig { kind: "disabled" },
    };
    let response = client
        .post(format!("{API_BASE_URL}/chat/completions"))
        .bearer_auth(api_key)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&request)
        .send()
        .map_err(|e| format!("request failed: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        let body = response
            .text()
            .unwrap_or_else(|_| "<unavailable>".to_string());
        return Err(format!("model request failed ({status}): {body}"));
    }
    let payload: MessageResponse = response
        .json()
        .map_err(|e| format!("decode response: {e}"))?;
    payload
        .choices
        .into_iter()
        .next()
        .map(|choice| choice.message.content.trim().to_string())
        .filter(|text| !text.is_empty())
        .ok_or_else(|| "model returned empty text".to_string())
}

pub fn plan_action(app: Option<&AppHandle>, message: &str, ctx: &HostContext) -> Result<HostAction, String> {
    let api_key = crate::settings::deepseek_api_key(app)?;
    let model = crate::settings::deepseek_model(app);
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("http client: {e}"))?;
    let request = MessageRequest {
        model: &model,
        max_tokens: 600,
        messages: vec![
            MessagePayload {
                role: "system",
                content: "你是 Musicmate 的意图规划器。只输出 JSON，不要 Markdown。\n\naction 必须是下列之一：chat、search_song、play_chart、explain_current、add_to_queue、play_next、create_playlist、add_to_playlist。\n\n工具语义：\n- chat：普通聊天、陪伴、回答音乐相关问题，不改播放列表与队列。\n- search_song：用户希望立刻搜索并播放某首/某类歌。query 填最适合搜索 QQ 音乐的关键词。\n- play_chart：用户要今日热门、热歌榜、排行榜、流行趋势、现在大家在听什么。chart 填 hot。\n- explain_current：用户问当前这首歌、歌词、评论、为什么推荐、这首歌怎么样。\n- add_to_queue：用户要把某首/某类歌加入播放队列稍后听，不立刻替换当前播放。query 填关键词。\n- play_next：用户要把某首/某类歌插队到下一首播放。query 填关键词。\n- create_playlist：用户要创建新歌单。playlist_name 填歌单名；如果同时提到了要往里加内容，query 填一个适合批量搜索的宽泛关键词，例如“周杰伦 经典”“华语 摇滚”“深夜 安静”。执行层会取多个搜索结果加入歌单，不要只写一首歌名。\n- add_to_playlist：用户要把某首/某类歌加入已有歌单。playlist_name 必须是 available_playlists 中已存在的名字（如果用户给的名字与之相似，匹配最接近的那个）。query 填关键词；如果用户只是要把\"当前这首歌\"加入歌单，query 留空。\n\n多首推荐规则：\n- 当用户说“推荐一些/来点/几首/歌单/一组/适合...的歌/民谣/摇滚/爵士/通勤/睡前”等泛类型推荐时，不要把类型词本身当歌名搜索。\n- 这类请求用 search_song 或 create_playlist，并额外输出 queries 数组，包含 5 到 8 个具体搜索词，格式优先为“歌名 歌手”。例如用户说“给我推荐一些民谣”，queries 可以是 [\"董小姐 宋冬野\", \"南山南 马頔\", \"成都 赵雷\", \"理想三旬 陈鸿宇\", \"安和桥 宋冬野\"]。\n- query 字段可填一个宽泛兜底词，例如“华语民谣”，但 queries 才是主要搜索依据。\n\n判断技巧：\n- \"放一首/我想听/给我来点\" → search_song\n- \"推荐一些/来点.../几首...\" → search_song，并给 queries 多首具体候选\n- \"加到队列/等会儿听/排上/加入待听\" → add_to_queue\n- \"下一首放…/接下来听…\" → play_next\n- \"建一个叫…的歌单/新建歌单\" → create_playlist\n- \"加进 X 歌单/收藏到 X\" → add_to_playlist（X 必须从 available_playlists 选最接近的）\n\nreply 是主播要先说的话，要自然、短，不要解释 JSON。".to_string(),
            },
            MessagePayload {
                role: "user",
                content: format!(
                    "当前上下文：{}\n\nlocal_playlists（用户已有的歌单名）：[{}]\n\n用户输入：{}\n\n输出格式：{{\"action\":\"search_song\",\"query\":\"华语民谣\",\"queries\":[\"董小姐 宋冬野\",\"南山南 马頔\"],\"chart\":null,\"playlist_name\":null,\"reply\":\"...\"}}。不需要的字段填 null，queries 没有时填 []。",
                    build_user_prompt(ctx),
                    ctx.available_playlists
                        .iter()
                        .map(|name| format!("\"{name}\""))
                        .collect::<Vec<_>>()
                        .join(","),
                    message
                ),
            },
        ],
        thinking: ThinkingConfig { kind: "disabled" },
    };
    let response = client
        .post(format!("{API_BASE_URL}/chat/completions"))
        .bearer_auth(api_key)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&request)
        .send()
        .map_err(|e| format!("request failed: {e}"))?;
    let status = response.status();
    if !status.is_success() {
        let body = response
            .text()
            .unwrap_or_else(|_| "<unavailable>".to_string());
        return Err(format!("model request failed ({status}): {body}"));
    }
    let payload: MessageResponse = response
        .json()
        .map_err(|e| format!("decode response: {e}"))?;
    let content = payload
        .choices
        .into_iter()
        .next()
        .map(|choice| choice.message.content)
        .ok_or_else(|| "model returned no action".to_string())?;
    parse_action_json(&content)
}

fn parse_action_json(content: &str) -> Result<HostAction, String> {
    let trimmed = content.trim();
    let json = if let (Some(start), Some(end)) = (trimmed.find('{'), trimmed.rfind('}')) {
        &trimmed[start..=end]
    } else {
        trimmed
    };
    serde_json::from_str(json).map_err(|e| format!("decode action json: {e}; content: {content}"))
}

fn build_system_prompt(persona: &Persona) -> String {
    format!(
        "你是 Musicmate 的 AI 主播 + 音乐伴侣，名字叫\"{}\"。你陪伴一位独自工作的朋友，他的副屏挂着你。\n\n你懂音乐——可以聊一首歌的背景、情绪、年代感，可以从听感印象描述它适合什么场景。基于用户最近听过的曲目，你也会主动推荐相关的作品。\n\n风格：{}\n- 1-3 句话，短句优先，不写长段。\n- 当上下文给了曲名、艺人、专辑，可以提一两句这首歌的\"点\"——比如这是谁的什么时期作品、什么氛围、和上一首的对照。不要硬塞知识、不要列百科。\n- 偶尔（不是每次）推荐一首相关的歌，直接说出曲名艺人，自然带过即可，不强求用户去听。\n- 不评论歌词字面意思，但可以谈整体情绪、画面感。\n- 不要每次都问\"工作怎么样\"。\n- 不用 emoji、不用\"咱们\"\"家人们\"\"宝子们\"这类过度亲昵的词。\n- 不要重复你之前说过的话。\n\n输出要求：直接给出要说的话，不要加任何前缀（如\"主播：\"）、引号、解释。",
        persona.name, persona.style
    )
}

fn build_user_prompt(ctx: &HostContext) -> String {
    let mut parts: Vec<String> = Vec::new();
    parts.push(format!("现在 {:02}:{:02}。", ctx.hour, ctx.minute));

    if let Some(gap) = describe_gap(ctx.session_gap_hours, ctx.total_sessions) {
        parts.push(gap);
    }

    match ctx.trigger {
        Trigger::Welcome => {
            if ctx.total_sessions <= 1 {
                parts.push("这是用户第一次打开你。说一句简短自然的开场，不要太隆重。".to_string());
            } else {
                parts.push("用户又来工作了，准备开始第一首歌。说一句开场。".to_string());
            }
        }
        Trigger::Hourly => {
            parts.push("整点了，简单说一句报时或者状态提醒。".to_string());
        }
        Trigger::Transition => {
            if let Some(previous_title) = &ctx.previous_title {
                let previous_artist = ctx
                    .previous_artist
                    .as_ref()
                    .map(|artist| format!(" - {artist}"))
                    .unwrap_or_default();
                parts.push(format!("刚才放完了《{previous_title}》{previous_artist}。"));
            }
            if let Some(current_title) = &ctx.current_title {
                let artist = ctx
                    .current_artist
                    .as_ref()
                    .map(|value| format!(" - {value}"))
                    .unwrap_or_default();
                let album = ctx
                    .current_album
                    .as_ref()
                    .map(|value| format!("（专辑：{value}）"))
                    .unwrap_or_default();
                parts.push(format!("接下来是《{current_title}》{artist}{album}。"));
            }
            parts.push("说一句简短的过渡，可以聊聊这首歌的氛围或推荐相关作品。".to_string());
        }
    }

    if ctx.recent_tracks.len() >= 3 {
        let recent = ctx
            .recent_tracks
            .iter()
            .rev()
            .skip(1)
            .take(MAX_RECENT_TRACKS_CONTEXT)
            .map(|track| format!("《{}》- {}", track.title, track.artist))
            .collect::<Vec<_>>()
            .join("、");
        if !recent.is_empty() {
            parts.push(format!("\n用户最近也听了：{recent}。"));
        }
    }

    if !ctx.spoken_lines.is_empty() {
        let recent_lines = ctx
            .spoken_lines
            .iter()
            .rev()
            .take(MAX_SPOKEN_CONTEXT)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .map(|line| format!("- {line}"))
            .collect::<Vec<_>>()
            .join("\n");
        parts.push(format!(
            "\n你最近说过的话（不要重复风格或内容）：\n{recent_lines}"
        ));
    }

    parts.join(" ")
}

fn describe_gap(hours: Option<f64>, total_sessions: u32) -> Option<String> {
    if total_sessions <= 1 {
        return None;
    }

    let hours = hours?;
    if hours < 0.5 {
        Some("（用户刚刚才关掉又打开了）".to_string())
    } else if hours < 4.0 {
        Some(format!("（距上次打开 {} 小时）", hours.round() as u64))
    } else if hours < 24.0 {
        Some("（今天稍早些时候用户也开过）".to_string())
    } else if hours < 48.0 {
        Some("（昨天用户也开过）".to_string())
    } else if hours < 24.0 * 7.0 {
        Some(format!("（距上次打开 {} 天）", (hours / 24.0).round() as u64))
    } else {
        Some("（很久没见了）".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_ctx(trigger: Trigger) -> HostContext {
        HostContext {
            persona: Persona {
                name: "Silen".to_string(),
                style: "松弛、克制".to_string(),
            },
            current_title: Some("Track B".to_string()),
            current_artist: Some("Artist B".to_string()),
            current_album: Some("Album B".to_string()),
            previous_title: Some("Track A".to_string()),
            previous_artist: Some("Artist A".to_string()),
            hour: 22,
            minute: 5,
            spoken_lines: vec!["上句".to_string(), "下句".to_string()],
            recent_tracks: vec![
                PlayedTrack {
                    title: "One".to_string(),
                    artist: "A".to_string(),
                },
                PlayedTrack {
                    title: "Two".to_string(),
                    artist: "B".to_string(),
                },
                PlayedTrack {
                    title: "Three".to_string(),
                    artist: "C".to_string(),
                },
            ],
            session_gap_hours: Some(3.2),
            total_sessions: 4,
            trigger,
            available_playlists: vec![],
        }
    }

    #[test]
    fn transition_prompt_contains_track_context() {
        let prompt = build_user_prompt(&sample_ctx(Trigger::Transition));
        assert!(prompt.contains("刚才放完了《Track A》 - Artist A。"));
        assert!(prompt.contains("接下来是《Track B》 - Artist B（专辑：Album B）。"));
        assert!(prompt.contains("用户最近也听了"));
    }

    #[test]
    fn welcome_prompt_handles_first_session() {
        let mut ctx = sample_ctx(Trigger::Welcome);
        ctx.total_sessions = 1;
        ctx.session_gap_hours = None;
        let prompt = build_user_prompt(&ctx);
        assert!(prompt.contains("这是用户第一次打开你"));
        assert!(!prompt.contains("距上次打开"));
    }
}
