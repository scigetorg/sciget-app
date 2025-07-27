#!/bin/bash

ln -s "/opt/ScigetApp/resources/app/scigetapp" /usr/bin/scigetapp
chmod 755 "/opt/ScigetApp/resources/app/scigetapp"

if type update-alternatives 2>/dev/null >&1; then
    # Remove previous link if it doesn't use update-alternatives
    if [ -L '/usr/bin/scigetapp' -a -e '/usr/bin/scigetapp' -a "`readlink '/usr/bin/scigetapp'`" != '/etc/alternatives/scigetapp' ]; then
        rm -f '/usr/bin/scigetapp'
    fi
    update-alternatives --install '/usr/bin/scigetapp' 'scigetapp' '/opt/ScigetApp/scigetapp' 100 || ln -sf '/opt/ScigetApp/scigetapp' '/usr/bin/scigetapp'
else
    ln -sf '/opt/ScigetApp/scigetapp' '/usr/bin/scigetapp'
fi

# Check if user namespaces are supported by the kernel and working with a quick test:
if ! { [[ -L /proc/self/ns/user ]] && unshare --user true; }; then
    # Use SUID chrome-sandbox only on systems without user namespaces:
    chmod 4755 '/opt/ScigetApp/chrome-sandbox' || true
else
    chmod 0755 '/opt/ScigetApp/chrome-sandbox' || true
fi

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi

# Install apparmor profile. (Ubuntu 24+)
# First check if the version of AppArmor running on the device supports our profile.
# This is in order to keep backwards compatibility with Ubuntu 22.04 which does not support abi/4.0.
# In that case, we just skip installing the profile since the app runs fine without it on 22.04.
#
# Those apparmor_parser flags are akin to performing a dry run of loading a profile.
# https://wiki.debian.org/AppArmor/HowToUse#Dumping_profiles
#
# Unfortunately, at the moment AppArmor doesn't have a good story for backwards compatibility.
# https://askubuntu.com/questions/1517272/writing-a-backwards-compatible-apparmor-profile
APPARMOR_PROFILE_SOURCE='/opt/ScigetApp/resources/apparmor-profile'
APPARMOR_PROFILE_TARGET='/etc/apparmor.d/scigetapp'
if test -d "/etc/apparmor.d"; then
  if apparmor_parser --skip-kernel-load --debug "$APPARMOR_PROFILE_SOURCE" > /dev/null 2>&1; then
    cp -f "$APPARMOR_PROFILE_SOURCE" "$APPARMOR_PROFILE_TARGET"

    # Updating the current AppArmor profile is not possible and probably not meaningful in a chroot'ed environment.
    # Use cases are for example environments where images for clients are maintained.
    # There, AppArmor might correctly be installed, but live updating makes no sense.
    if ! { [ -x '/usr/bin/ischroot' ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
      # Extra flags taken from dh_apparmor:
      # > By using '-W -T' we ensure that any abstraction updates are also pulled in.
      # https://wiki.debian.org/AppArmor/Contribute/FirstTimeProfileImport
      apparmor_parser --replace --write-cache --skip-read-cache "$APPARMOR_PROFILE_TARGET"
    fi
  else
    echo "Skipping the installation of the AppArmor profile as this version of AppArmor does not seem to support the bundled profile"
  fi
fi