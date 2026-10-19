#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Manager, Url};

const CHANGE_LINK_ID: &str = "change-meeting-link";
const RELOAD_ID: &str = "reload-meeting";

/// The local launcher URL, remembered so the native menu can return to it
/// after the main window has navigated to a remote meeting.
struct LauncherUrl(Url);

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

#[cfg(dev)]
const LAUNCHER_URL: &str = "http://localhost:1420/";

#[cfg(all(not(dev), windows))]
const LAUNCHER_URL: &str = "http://tauri.localhost/";

#[cfg(all(not(dev), not(windows)))]
const LAUNCHER_URL: &str = "tauri://localhost/";

fn default_launcher_url() -> Url {
    Url::parse(LAUNCHER_URL).expect("valid launcher URL")
}

fn launcher_url<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) -> Url {
    window.url().unwrap_or_else(|_| default_launcher_url())
}

fn build_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    let change_link = MenuItem::with_id(
        app,
        CHANGE_LINK_ID,
        "Change Meeting Link…",
        true,
        Some("CmdOrCtrl+Shift+L"),
    )?;
    let reload = MenuItem::with_id(app, RELOAD_ID, "Reload Meeting", true, Some("CmdOrCtrl+R"))?;

    #[cfg(target_os = "macos")]
    {
        let about = PredefinedMenuItem::about(app, Some("About Jitsi Meet"), None)?;
        let services = PredefinedMenuItem::services(app, None)?;
        let hide = PredefinedMenuItem::hide(app, None)?;
        let hide_others = PredefinedMenuItem::hide_others(app, None)?;
        let show_all = PredefinedMenuItem::show_all(app, None)?;
        let quit = PredefinedMenuItem::quit(app, None)?;
        let app_separator_one = PredefinedMenuItem::separator(app)?;
        let app_separator_two = PredefinedMenuItem::separator(app)?;
        let app_separator_three = PredefinedMenuItem::separator(app)?;

        let app_menu = Submenu::with_items(
            app,
            "Jitsi Meet",
            true,
            &[
                &about,
                &app_separator_one,
                &services,
                &app_separator_two,
                &hide,
                &hide_others,
                &show_all,
                &app_separator_three,
                &quit,
            ],
        )?;
        let meeting_menu = Submenu::with_items(app, "Meeting", true, &[&change_link, &reload])?;

        Menu::with_items(app, &[&app_menu, &meeting_menu])
    }

    #[cfg(not(target_os = "macos"))]
    {
        let quit = PredefinedMenuItem::quit(app, Some("Quit"))?;
        let meeting_separator = PredefinedMenuItem::separator(app)?;
        let meeting_menu = Submenu::with_items(
            app,
            "Meeting",
            true,
            &[&change_link, &reload, &meeting_separator, &quit],
        )?;

        Menu::with_items(app, &[&meeting_menu])
    }
}

fn main() {
    let builder = tauri::Builder::default()
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("the main window must exist");

            app.manage(LauncherUrl(launcher_url(&window)));
            app.set_menu(build_menu(app.handle())?)?;

            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            CHANGE_LINK_ID => {
                if let (Some(window), Some(launcher)) = (
                    app.get_webview_window("main"),
                    app.try_state::<LauncherUrl>(),
                ) {
                    let _ = window.navigate(launcher.0.clone());
                }
            }
            RELOAD_ID => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.reload();
                }
            }
            _ => {}
        });

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
        .expect("failed to run Jitsi Meet");
}
