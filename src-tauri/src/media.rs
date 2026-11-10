use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use lofty::file::{AudioFile, TaggedFileExt};
use lofty::picture::PictureType;
use lofty::tag::Accessor;
use serde::Serialize;
use std::path::{Path, PathBuf};

const MAX_ARTWORK_BYTES: usize = 5 * 1024 * 1024;
const MAX_SUBTITLE_BYTES: u64 = 4 * 1024 * 1024;
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "m4a", "aac", "wav", "flac", "ogg", "oga", "opus"];

#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    file_name: String,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    duration: Option<f64>,
    has_artwork: bool,
}

fn clean(value: Option<std::borrow::Cow<'_, str>>) -> Option<String> {
    value
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Unknown media".to_owned())
}

fn probe_sync(path: &str) -> Result<MediaInfo, String> {
    let file_path = Path::new(path);
    if !file_path.is_file() {
        return Err("That file could not be found.".to_owned());
    }

    let extension = file_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if !AUDIO_EXTENSIONS.contains(&extension.as_str()) {
        return Ok(MediaInfo {
            file_name: file_name(file_path),
            ..MediaInfo::default()
        });
    }

    let tagged_file = lofty::read_from_path(file_path)
        .map_err(|error| format!("Unable to read media metadata: {error}"))?;
    let properties = tagged_file.properties();
    let duration = properties.duration().as_secs_f64();
    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());
    let has_artwork = tag.map(|tag| !tag.pictures().is_empty()).unwrap_or(false);

    Ok(MediaInfo {
        file_name: file_name(file_path),
        title: tag.and_then(|tag| clean(tag.title())),
        artist: tag.and_then(|tag| clean(tag.artist())),
        album: tag.and_then(|tag| clean(tag.album())),
        duration: (duration > 0.0).then_some(duration),
        has_artwork,
    })
}

fn artwork_sync(path: &str) -> Result<Option<String>, String> {
    let file_path = Path::new(path);
    if !file_path.is_file() {
        return Err("That file could not be found.".to_owned());
    }

    let tagged_file = lofty::read_from_path(file_path)
        .map_err(|error| format!("Unable to read embedded artwork: {error}"))?;
    let Some(tag) = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag())
    else {
        return Ok(None);
    };

    let pictures = tag.pictures();
    let picture = pictures
        .iter()
        .find(|picture| picture.pic_type() == PictureType::CoverFront)
        .or_else(|| pictures.first());

    let Some(picture) = picture else {
        return Ok(None);
    };
    if picture.data().is_empty() || picture.data().len() > MAX_ARTWORK_BYTES {
        return Ok(None);
    }

    let mime = picture
        .mime_type()
        .map(ToString::to_string)
        .unwrap_or_else(|| "image/jpeg".to_owned());
    let encoded = STANDARD.encode(picture.data());

    Ok(Some(format!("data:{mime};base64,{encoded}")))
}

fn srt_to_vtt(input: &str) -> String {
    let mut output = String::with_capacity(input.len() + 16);
    for line in input.lines() {
        if line.contains("-->") {
            output.push_str(&line.replace(',', "."));
        } else {
            output.push_str(line);
        }
        output.push('\n');
    }
    output
}

fn subtitle_sync(video_path: &str) -> Result<Option<String>, String> {
    let video = Path::new(video_path);
    if !video.is_file() {
        return Err("That video could not be found.".to_owned());
    }

    let Some(parent) = video.parent() else {
        return Ok(None);
    };
    let Some(stem) = video.file_stem().and_then(|value| value.to_str()) else {
        return Ok(None);
    };
    let stem = stem.to_lowercase();

    let entries = match std::fs::read_dir(parent) {
        Ok(entries) => entries,
        Err(_) => return Ok(None),
    };

    let mut vtt_path: Option<PathBuf> = None;
    let mut srt_path: Option<PathBuf> = None;

    for entry in entries.flatten() {
        let candidate = entry.path();
        if !candidate.is_file() {
            continue;
        }

        let candidate_stem = candidate
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or_default();
        if candidate_stem.to_lowercase() != stem {
            continue;
        }

        let extension = candidate
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();

        if extension == "vtt" {
            vtt_path = Some(candidate);
            break;
        }

        if extension == "srt" && srt_path.is_none() {
            srt_path = Some(candidate);
        }
    }

    let Some(path) = vtt_path.or(srt_path) else {
        return Ok(None);
    };
    let from_srt = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("srt"))
        .unwrap_or(false);

    let metadata = match std::fs::metadata(&path) {
        Ok(metadata) => metadata,
        Err(_) => return Ok(None),
    };
    if metadata.len() > MAX_SUBTITLE_BYTES {
        return Ok(None);
    }

    let bytes =
        std::fs::read(&path).map_err(|error| format!("Unable to read subtitles: {error}"))?;
    let text = String::from_utf8_lossy(&bytes);
    let text = text.trim_start_matches('\u{feff}').replace("\r\n", "\n");
    let text = text.replace('\r', "\n");

    if from_srt {
        let converted = srt_to_vtt(&text);
        if !converted.trim_start().to_uppercase().starts_with("WEBVTT") {
            Ok(Some(format!("WEBVTT\n\n{converted}")))
        } else {
            Ok(Some(converted))
        }
    } else if !text.trim_start().to_uppercase().starts_with("WEBVTT") {
        Ok(Some(format!("WEBVTT\n\n{text}")))
    } else {
        Ok(Some(text))
    }
}

#[tauri::command]
pub async fn probe_media(path: String) -> Result<MediaInfo, String> {
    tauri::async_runtime::spawn_blocking(move || probe_sync(&path))
        .await
        .map_err(|error| format!("Media probe task failed: {error}"))?
}

#[tauri::command]
pub async fn read_artwork(path: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || artwork_sync(&path))
        .await
        .map_err(|error| format!("Artwork task failed: {error}"))?
}

#[tauri::command]
pub async fn read_subtitle(video_path: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || subtitle_sync(&video_path))
        .await
        .map_err(|error| format!("Subtitle task failed: {error}"))?
}
