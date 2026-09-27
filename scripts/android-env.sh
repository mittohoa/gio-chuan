#!/usr/bin/env bash
# Dò và xuất biến môi trường cần cho build Android.
#
#   source scripts/android-env.sh
#   npm run android:build
#
# Viết cho Git Bash trên Windows, nhưng chạy được cả trên Linux/macOS.
# Không tự cài gì — chỉ tìm những thứ đã có và báo rõ cái nào còn thiếu.

_fail() { echo "  THIẾU: $1" >&2; _missing=1; }
_missing=0

# ---------------------------------------------------------------- Android SDK
if [ -z "$ANDROID_HOME" ]; then
  for _c in "$LOCALAPPDATA/Android/Sdk" "$HOME/Android/Sdk" "$HOME/Library/Android/sdk"; do
    [ -d "$_c" ] && ANDROID_HOME="$_c" && break
  done
fi
if [ -d "$ANDROID_HOME" ]; then
  export ANDROID_HOME
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
  echo "  ANDROID_HOME = $ANDROID_HOME"
else
  _fail "Android SDK (cài qua Android Studio, hoặc đặt sẵn ANDROID_HOME)"
fi

# ------------------------------------------------------------------- NDK r28+
# Play chặn phát hành nếu thư viện .so không hỗ trợ trang bộ nhớ 16 KB, và chỉ
# NDK r28 trở lên mới sinh ra .so đạt yêu cầu đó.
if [ -z "$NDK_HOME" ] && [ -d "$ANDROID_HOME/ndk" ]; then
  _best=""
  for _d in "$ANDROID_HOME/ndk"/*; do
    [ -d "$_d" ] || continue
    _major="${_d##*/}"
    _major="${_major%%.*}"
    case "$_major" in ''|*[!0-9]*) continue ;; esac
    [ "$_major" -ge 28 ] || continue
    if [ -z "$_best" ] || [ "$_d" \> "$_best" ]; then _best="$_d"; fi
  done
  NDK_HOME="$_best"
fi
if [ -d "$NDK_HOME" ]; then
  export NDK_HOME
  export ANDROID_NDK_ROOT="$NDK_HOME"
  echo "  NDK_HOME     = $NDK_HOME"
else
  _fail "NDK r28 trở lên — cài bằng: sdkmanager --install \"ndk;28.2.13676358\""
fi

# -------------------------------------------------------------------- JDK 17+
# Android Gradle Plugin 8.x và sdkmanager đều từ chối chạy trên JDK cũ hơn 17.
_java_major() {
  "$1/bin/java" -version 2>&1 | head -1 \
    | sed -E 's/.*version "([0-9]+).*/\1/'
}
if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
  _v=$(_java_major "$JAVA_HOME")
  [ "${_v:-0}" -lt 17 ] 2>/dev/null && JAVA_HOME=""
fi
if [ -z "$JAVA_HOME" ]; then
  for _c in "$HOME/tools"/jdk-2* "$PROGRAMFILES/Eclipse Adoptium"/jdk-2* \
            "$PROGRAMFILES/Microsoft"/jdk-2* "$PROGRAMFILES/Java"/jdk-2* \
            "/usr/lib/jvm"/java-2*-openjdk*; do
    [ -x "$_c/bin/java" ] || continue
    _v=$(_java_major "$_c")
    if [ "${_v:-0}" -ge 17 ] 2>/dev/null; then JAVA_HOME="$_c"; break; fi
  done
fi
if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
  export JAVA_HOME
  PATH="$JAVA_HOME/bin:$PATH"
  echo "  JAVA_HOME    = $JAVA_HOME (Java $(_java_major "$JAVA_HOME"))"
else
  _fail "JDK 17 trở lên"
fi

# ----------------------------------------------------------------------- Rust
if ! command -v cargo >/dev/null 2>&1 && [ -d "$HOME/.cargo/bin" ]; then
  PATH="$HOME/.cargo/bin:$PATH"
fi
if command -v rustc >/dev/null 2>&1; then
  echo "  Rust         = $(rustc --version)"
  _need="aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android"
  _have=$(rustup target list --installed 2>/dev/null)
  for _t in $_need; do
    echo "$_have" | grep -qx "$_t" || _fail "target Rust $_t (rustup target add $_t)"
  done
else
  _fail "Rust (cài tại https://rustup.rs)"
fi

# ------------------------------------------------------------------ tiện dụng
[ -d "$ANDROID_HOME/platform-tools" ] && PATH="$ANDROID_HOME/platform-tools:$PATH"
[ -d "$ANDROID_HOME/emulator" ] && PATH="$ANDROID_HOME/emulator:$PATH"
[ -d "$ANDROID_HOME/cmdline-tools/latest/bin" ] && PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
export PATH

if [ "$_missing" = 1 ]; then
  echo "  => Còn thiếu thành phần, xem danh sách ở trên." >&2
else
  echo "  => Đủ toolchain. Chạy được: npm run android:dev / npm run android:build"
fi

unset _c _d _t _v _best _major _need _have _missing
