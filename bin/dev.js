#!/usr/bin/env -S node --loader ts-node/esm --disable-warning=ExperimentalWarning --experimental-specifier-resolution=node

// eslint-disable-next-line n/shebang
import {execute} from '@oclif/core'

await execute({development: true, dir: import.meta.url})
