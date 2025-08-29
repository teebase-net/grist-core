declare module 'app/client/models/GristDoc' {
  interface GristDoc {
    regionFocusSwitcher?: any; // Allow any type since not used
    userPresenceModel?: any; // Allow any type since not used
    copyAnchorLink?: (...args: any[]) => Promise<void>; // Allow any arguments
  }
}
