// Where the sidebar's collapsed or expanded state is remembered. Kept out of sidebar.tsx, which is
// a client module: the server layout would receive a reference to the constant there, not its value.
export const SIDEBAR_COOKIE = "mmm_sidebar";
