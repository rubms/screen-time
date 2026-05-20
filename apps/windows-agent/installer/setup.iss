; Inno Setup stub — Screen Time Control Windows Agent
#define MyAppName "Screen Time Control"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Screen Time Control"
#define MyAppExeName "ScreenTimeControl-0.1.0.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\ScreenTimeControl
DefaultGroupName={#MyAppName}
OutputDir=..\dist\installer
OutputBaseFilename=ScreenTimeControl-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin

[Files]
Source: "..\dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"

[Run]
; Install Windows service and register watchdog scheduled task
Filename: "{app}\{#MyAppExeName}"; Parameters: "service install"; Flags: runhidden waituntilterminated
Filename: "{app}\{#MyAppExeName}"; Parameters: "service start"; Flags: runhidden waituntilterminated

[UninstallRun]
Filename: "{app}\{#MyAppExeName}"; Parameters: "service stop"; Flags: runhidden
Filename: "{app}\{#MyAppExeName}"; Parameters: "service uninstall"; Flags: runhidden
