#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::sync::Mutex;
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

#[derive(Clone, Serialize)]
struct Document {
    revision: u64,
    drive: u8,
    adv: bool,
    eq: [u8; 5],
    simple: Controls,
    synth: Controls,
    theme: String,
    language: String,
}

#[derive(Clone, Serialize)]
struct Controls {
    drive: u8,
    adv: bool,
    eq: [u8; 5],
}

impl Default for Document {
    fn default() -> Self {
        Self {
            revision: 0,
            drive: 36,
            adv: true,
            eq: [43, 65, 43, 29, 50],
            simple: Controls {
                drive: 36,
                adv: true,
                eq: [43, 65, 43, 29, 50],
            },
            synth: Controls {
                drive: 36,
                adv: true,
                eq: [43, 65, 43, 29, 50],
            },
            theme: "black".into(),
            language: "en".into(),
        }
    }
}

#[derive(Default)]
struct Rack(Mutex<Document>);

#[tauri::command]
fn snapshot(rack: State<'_, Rack>) -> Result<Document, String> {
    let document = rack.0.lock().map_err(|error| error.to_string())?;
    Ok(document.clone())
}

#[tauri::command]
fn update(
    app: tauri::AppHandle,
    rack: State<'_, Rack>,
    key: &str,
    value: &str,
) -> Result<Document, String> {
    let level = || {
        value
            .parse::<u8>()
            .ok()
            .filter(|level| *level <= 100)
            .ok_or_else(|| "Invalid level".to_string())
    };
    let mut document = rack.0.lock().map_err(|error| error.to_string())?;
    match key {
        "drive" => document.drive = level()?,
        "adv" => document.adv = value.parse::<bool>().map_err(|error| error.to_string())?,
        "low" => document.eq[0] = level()?,
        "mid" => document.eq[1] = level()?,
        "high" => document.eq[2] = level()?,
        "air" => document.eq[3] = level()?,
        "cut" => document.eq[4] = level()?,
        "simple.drive" => document.simple.drive = level()?,
        "simple.adv" => {
            document.simple.adv = value.parse::<bool>().map_err(|error| error.to_string())?
        }
        "simple.low" => document.simple.eq[0] = level()?,
        "simple.mid" => document.simple.eq[1] = level()?,
        "simple.high" => document.simple.eq[2] = level()?,
        "simple.air" => document.simple.eq[3] = level()?,
        "simple.cut" => document.simple.eq[4] = level()?,
        "synth.drive" => document.synth.drive = level()?,
        "synth.adv" => {
            document.synth.adv = value.parse::<bool>().map_err(|error| error.to_string())?
        }
        "synth.low" => document.synth.eq[0] = level()?,
        "synth.mid" => document.synth.eq[1] = level()?,
        "synth.high" => document.synth.eq[2] = level()?,
        "synth.air" => document.synth.eq[3] = level()?,
        "synth.cut" => document.synth.eq[4] = level()?,
        "theme" if matches!(value, "black" | "white") => document.theme = value.into(),
        "language" if matches!(value, "en" | "ja" | "zh-CN") => document.language = value.into(),
        "reset" => {
            let defaults = Document::default();
            document.drive = defaults.drive;
            document.adv = defaults.adv;
            document.eq = defaults.eq;
            document.simple = defaults.simple;
            document.synth = defaults.synth;
        }
        _ => return Err("Invalid control".into()),
    }
    document.revision += 1;
    app.emit("rack-change", &*document)
        .map_err(|error| error.to_string())?;
    Ok(document.clone())
}

#[tauri::command]
async fn panel(app: tauri::AppHandle, name: String, floating: bool) -> Result<(), String> {
    let (width, height) = match name.as_str() {
        "drive" => (320.0, 450.0),
        "adv" => (320.0, 400.0),
        "eq" => (420.0, 470.0),
        _ => return Err("Invalid panel".into()),
    };
    if let Some(window) = app.get_webview_window(&name) {
        return if floating {
            window.set_focus()
        } else {
            window.close()
        }
        .map_err(|error| error.to_string());
    }
    if !floating {
        return Ok(());
    }
    let handle = app.clone();
    let builder = WebviewWindowBuilder::new(
        &app,
        &name,
        WebviewUrl::App(format!("index.html?panel={name}").into()),
    )
    .title(name.to_uppercase())
    .inner_size(width, height)
    .min_inner_size(320.0, 360.0);
    let builder = match app.get_webview_window("main") {
        Some(main) => builder.parent(&main).map_err(|error| error.to_string())?,
        None => builder,
    };
    let window = builder.build().map_err(|error| error.to_string())?;
    let label = name.clone();
    window.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Destroyed) {
            let _ = handle.emit("panel-docked", &label);
        }
    });
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(Rack::default())
        .invoke_handler(tauri::generate_handler![snapshot, update, panel])
        .run(tauri::generate_context!())
        .expect("failed to run Alloy");
}
