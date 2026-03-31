/// <reference types="vite/client" />

declare const APP_VERSION: string;

declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.svg" {
  const value: string; // If you use vite-plugin-svgr or similar, you might change this to React.FunctionComponent<React.SVGAttributes<SVGElement>>
  export default value;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

declare module "*.jpeg" {
  const value: string;
  export default value;
}

declare module "*.gif" {
  const value: string;
  export default value;
}
