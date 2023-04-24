export enum ResponseCodes {
  Success = 'SUCCESS',
  AppDeleted = 'APP_DELETED',
  AppStarted = 'ACTION_SENT',
  AppStopped = 'ACTION_SENT',
  AppRestarted = 'ACTION_SENT',
}

export enum Routes {
  Status = 'status',
  Logs = 'logs',
  FullLogs = 'full-logs',
  Backup = 'backup',
  Commit = 'commit',
  Delete = 'delete',
  Start = 'start',
  Stop = 'stop',
  Restart = 'restart',
  Upload = 'upload',
  User = 'user',
}
