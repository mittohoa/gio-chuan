// Tren Windows o ban release khong mo cua so console kem theo.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mittohoa_timeis_lib::run()
}
