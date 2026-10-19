#!/usr/bin/env bash
# Builds Lua 5.4, Prosody 13.0.7 and the Lua libraries that Prosody and the Jitsi plugins load, into
# /opt/jitsi-meet/app. The install path is fixed, because Prosody and luarocks write absolute paths
# into their files. The launcher unpacks the payload to /opt/jitsi-meet, so the paths match on the server.
set -euo pipefail

APP=/opt/jitsi-meet/app
LUA_VERSION=5.4.9
LUA_SHA256=2335b6c582a52654f94612bf10d2f4672805d05329aa6568b1d8cd9e5c6fb8e6
PROSODY_VERSION=13.0.7
PROSODY_SHA256=f671df3c7535c7269afc89579ea26fc13d1006b40ef5df4ccb71a560197f151b

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

sudo install -d -o "$(id -u)" -g "$(id -g)" /opt/jitsi-meet "$APP"

echo "==> Lua $LUA_VERSION"
curl -fsSL -o lua.tar.gz "https://www.lua.org/ftp/lua-$LUA_VERSION.tar.gz"
echo "$LUA_SHA256  lua.tar.gz" | sha256sum -c -
tar -xzf lua.tar.gz
# The linux target links the interpreter against the static liblua.a and exports its symbols, so that
# the C modules below can load without a separate liblua.so.
make -C "lua-$LUA_VERSION" linux
make -C "lua-$LUA_VERSION" install INSTALL_TOP="$APP/lua"
LUA="$APP/lua/bin/lua"
"$LUA" -v

echo "==> Prosody $PROSODY_VERSION"
curl -fsSL -o prosody.tar.gz "https://prosody.im/downloads/source/prosody-$PROSODY_VERSION.tar.gz"
echo "$PROSODY_SHA256  prosody.tar.gz" | sha256sum -c -
tar -xzf prosody.tar.gz
cd "prosody-$PROSODY_VERSION"
./configure --ostype=linux \
    --prefix="$APP/prosody" \
    --sysconfdir="$APP/prosody/etc" \
    --libdir="$APP/prosody/lib" \
    --datadir="$APP/prosody/share" \
    --with-lua="$APP/lua" \
    --with-lua-bin="$APP/lua/bin" \
    --with-lua-include="$APP/lua/include"
make
make install
cd "$WORK"

echo "==> Lua libraries for Prosody and the Jitsi plugins"
# luarocks is only the installer here; the trees are written under $APP/rocks.
sudo apt-get install -y --no-install-recommends luarocks libssl-dev libexpat1-dev >/dev/null
for rock in luasocket luasec luaexpat luafilesystem basexx lua-cjson; do
    luarocks --lua-version=5.4 --lua-dir="$APP/lua" --tree="$APP/rocks" install "$rock"
done

# The launcher finds the Lua runtime and its paths through these files, so check them here, where a
# missing library fails the build instead of the server.
export LUA_PATH="$APP/rocks/share/lua/5.4/?.lua;$APP/rocks/share/lua/5.4/?/init.lua;;"
export LUA_CPATH="$APP/rocks/lib/lua/5.4/?.so;;"
"$LUA" -e 'require "socket"; require "ssl"; require "lxp"; require "lfs"; require "basexx"; require "cjson"; print("rocks ok")'
test -x "$APP/prosody/bin/prosody"
echo "prosody runtime ready in $APP"
