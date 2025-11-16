declare module 'require-in-the-middle' {
  function hook(
    modules: string[] | null,
    callback: (exports: unknown, name: string, basedir?: string) => unknown
  ): { unhook: () => void }

  export = hook
}
