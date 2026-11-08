/** The packaged Agent Canvas app installs beside official Orca: its own profile, and no auto-update over it. */
export const CANVAS_STANDALONE_BUILD =
  typeof ORCA_CANVAS_STANDALONE !== 'undefined' && ORCA_CANVAS_STANDALONE === true
export const CANVAS_STANDALONE_USER_DATA_DIR = 'orca-canvas'
