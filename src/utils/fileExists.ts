import { access, constants } from "fs/promises"

export const fileExists = (filename: string): Promise<boolean> =>
  access(filename, constants.F_OK)
    .then(() => true)
    .catch(() => false)
