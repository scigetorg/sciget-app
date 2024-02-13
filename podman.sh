        if [[ "$(podman image inspect vnmd/neurodesktop:2024-01-12 --format='exists' 2> /dev/null)" == "exists" ]]; then 
              podman container exists neurodeskapp-44933 &> /dev/null && podman rm -f neurodeskapp-44933 
              podman volume exists neurodesk-home &> /dev/null || podman volume create neurodesk-home
              podman run -d --shm-size=1gb -it --privileged --user=root --name neurodeskapp-44933 -p 44933:44933 -v neurodesk-home:/home/jovyan -e NB_UID="$(id -u)" -e NB_GID="$(id -g)" -v ~/neurodesktop-storage:/neurodesktop-storage -e NEURODESKTOP_VERSION=2024-01-12 vnmd/neurodesktop:2024-01-12 start.sh jupyter lab --ServerApp.password="" --no-browser --expose-app-in-browser --ServerApp.token="jlab:srvr:40567271bab5054a379bc3bc3f220bc131886c" --ServerApp.port=44933 --LabApp.quit_button=False
        else
          podman container exists neurodeskapp-44933 &> /dev/null && podman rm -f neurodeskapp-44933 
          podman volume exists neurodesk-home &> /dev/null || podman volume create neurodesk-home
          podman pull vnmd/neurodesktop:2024-01-12
          podman run -d --shm-size=1gb -it --privileged --user=root --name neurodeskapp-44933 -p 44933:44933 -v neurodesk-home:/home/jovyan -e NB_UID="$(id -u)" -e NB_GID="$(id -g)" -v ~/neurodesktop-storage:/neurodesktop-storage -e NEURODESKTOP_VERSION=2024-01-12 vnmd/neurodesktop:2024-01-12 start.sh jupyter lab --ServerApp.password="" --no-browser --expose-app-in-browser --ServerApp.token="jlab:srvr:40567271bab5054a379bc3bc3f220bc131886c" --ServerApp.port=44933 --LabApp.quit_button=False
        fi