!macro customHeader
  BrandingText "SlayCam · by grossmeister"
!macroend

!include x64.nsh

!macro customInstall
  ${If} ${FileExists} "$INSTDIR\resources\virtual-camera\x64\slaycam-virtualcam.dll"
    ${DisableX64FSRedirection}
    ExecWait '"$WINDIR\System32\regsvr32.exe" /s "$INSTDIR\resources\virtual-camera\x64\slaycam-virtualcam.dll"'
    ${EnableX64FSRedirection}
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\resources\virtual-camera\x86\slaycam-virtualcam.dll"
    ExecWait '"$WINDIR\SysWOW64\regsvr32.exe" /s "$INSTDIR\resources\virtual-camera\x86\slaycam-virtualcam.dll"'
  ${EndIf}
!macroend

!macro customUnInstall
  ${If} ${FileExists} "$INSTDIR\resources\virtual-camera\x64\slaycam-virtualcam.dll"
    ${DisableX64FSRedirection}
    ExecWait '"$WINDIR\System32\regsvr32.exe" /s /u "$INSTDIR\resources\virtual-camera\x64\slaycam-virtualcam.dll"'
    ${EnableX64FSRedirection}
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\resources\virtual-camera\x86\slaycam-virtualcam.dll"
    ExecWait '"$WINDIR\SysWOW64\regsvr32.exe" /s /u "$INSTDIR\resources\virtual-camera\x86\slaycam-virtualcam.dll"'
  ${EndIf}
!macroend
