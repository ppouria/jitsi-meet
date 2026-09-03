#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
use tauri::Manager;

#[cfg(target_os = "windows")]
fn set_memory_usage<R: tauri::Runtime>(webview: tauri::WebviewWindow<R>, focused: bool) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL,
    };
    use windows::core::Interface;

    let level = COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL(i32::from(!focused));

    let _ = webview.with_webview(move |platform_webview| {
        if let Ok(core) = unsafe { platform_webview.controller().CoreWebView2() } {
            if let Ok(core) = core.cast::<ICoreWebView2_19>() {
                let _ = unsafe { core.SetMemoryUsageTargetLevel(level) };
            }
        }
    });
}

fn main() {
    let builder = tauri::Builder::default();

    #[cfg(target_os = "windows")]
    let builder = builder.on_window_event(|window, event| {
        if let tauri::WindowEvent::Focused(focused) = event {
            if let Some(webview) = window.get_webview_window(window.label()) {
                set_memory_usage(webview, *focused);
            }
        }
    });

    builder
        .run(tauri::generate_context!())
        .expect("failed to run Mazholl Voice");
}
