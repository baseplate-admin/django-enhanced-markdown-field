import { Config } from '@stencil/core';
import { sass } from '@stencil/sass';

export const config: Config = {
  namespace: 'django-markdown-field',
  plugins: [sass()],
  sourceMap: false,
  srcDir: 'src/frontend',
  outputTargets: [
    {
      type: 'dist-custom-elements',
      minify: true,
      generateTypeDeclarations: false,
      customElementsExportBehavior: 'auto-define-custom-elements' /*'auto-define-custom-elements'*/,
      externalRuntime: false,
      empty: true,
    },
    {
      type: 'www',
      serviceWorker: null, // disable service workers
    },
  ],
  testing: {
    browserHeadless: 'shell',
  },
};
