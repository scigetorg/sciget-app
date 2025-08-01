#!/bin/bash

# Delete the link to the binary
if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove 'scigetapp' '/usr/bin/scigetapp'
else
    rm -f '/usr/bin/scigetapp'
fi

APPARMOR_PROFILE_DEST='/etc/apparmor.d/scigetapp'

# Remove apparmor profile.
if [ -f "$APPARMOR_PROFILE_DEST" ]; then
  rm -f "$APPARMOR_PROFILE_DEST"
fi