{pkgs, ...}: {
  channel = "stable-25.05";
  packages = [
    pkgs.corepack
    pkgs.nodejs
    pkgs.uv
    pkgs.pnpm
  ];
}
