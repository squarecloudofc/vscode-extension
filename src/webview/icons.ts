// Phosphor icons (@phosphor-icons/core), imported as SVG text at build time
// and drawn by <Icon> as one path in currentColor. The site's map: 16 px,
// regular weight, fill on the active nav item (the NAV names have both).
// Codicons stay where VS Code draws (title bar, status bar, QuickPick).

import bracketsCurlyFill from "@phosphor-icons/core/fill/brackets-curly-fill.svg";
import cellTowerFill from "@phosphor-icons/core/fill/cell-tower-fill.svg";
import chartLineFill from "@phosphor-icons/core/fill/chart-line-fill.svg";
import clockCounterClockwiseFill from "@phosphor-icons/core/fill/clock-counter-clockwise-fill.svg";
import cloudArrowUpFill from "@phosphor-icons/core/fill/cloud-arrow-up-fill.svg";
import databaseFill from "@phosphor-icons/core/fill/database-fill.svg";
import folderFill from "@phosphor-icons/core/fill/folder-fill.svg";
import gaugeFill from "@phosphor-icons/core/fill/gauge-fill.svg";
import gearFill from "@phosphor-icons/core/fill/gear-fill.svg";
import globeFill from "@phosphor-icons/core/fill/globe-fill.svg";
import rocketFill from "@phosphor-icons/core/fill/rocket-fill.svg";
import squaresFourFill from "@phosphor-icons/core/fill/squares-four-fill.svg";
import starFill from "@phosphor-icons/core/fill/star-fill.svg";
import terminalWindowFill from "@phosphor-icons/core/fill/terminal-window-fill.svg";
import usersThreeFill from "@phosphor-icons/core/fill/users-three-fill.svg";
import warningOctagonFill from "@phosphor-icons/core/fill/warning-octagon-fill.svg";
import arrowClockwise from "@phosphor-icons/core/regular/arrow-clockwise.svg";
import arrowRight from "@phosphor-icons/core/regular/arrow-right.svg";
import arrowSquareOut from "@phosphor-icons/core/regular/arrow-square-out.svg";
import bracketsCurly from "@phosphor-icons/core/regular/brackets-curly.svg";
import broom from "@phosphor-icons/core/regular/broom.svg";
import caretDown from "@phosphor-icons/core/regular/caret-down.svg";
import caretLeft from "@phosphor-icons/core/regular/caret-left.svg";
import caretRight from "@phosphor-icons/core/regular/caret-right.svg";
import cellTower from "@phosphor-icons/core/regular/cell-tower.svg";
import certificate from "@phosphor-icons/core/regular/certificate.svg";
import chartLine from "@phosphor-icons/core/regular/chart-line.svg";
import check from "@phosphor-icons/core/regular/check.svg";
import checkCircle from "@phosphor-icons/core/regular/check-circle.svg";
import clockCounterClockwise from "@phosphor-icons/core/regular/clock-counter-clockwise.svg";
import cloudArrowUp from "@phosphor-icons/core/regular/cloud-arrow-up.svg";
import copy from "@phosphor-icons/core/regular/copy.svg";
import database from "@phosphor-icons/core/regular/database.svg";
import dotsThree from "@phosphor-icons/core/regular/dots-three.svg";
import downloadSimple from "@phosphor-icons/core/regular/download-simple.svg";
import eye from "@phosphor-icons/core/regular/eye.svg";
import eyeSlash from "@phosphor-icons/core/regular/eye-slash.svg";
import file from "@phosphor-icons/core/regular/file.svg";
import filePlus from "@phosphor-icons/core/regular/file-plus.svg";
import folder from "@phosphor-icons/core/regular/folder.svg";
import folderOpen from "@phosphor-icons/core/regular/folder-open.svg";
import folderPlus from "@phosphor-icons/core/regular/folder-plus.svg";
import gauge from "@phosphor-icons/core/regular/gauge.svg";
import gear from "@phosphor-icons/core/regular/gear.svg";
import gitBranch from "@phosphor-icons/core/regular/git-branch.svg";
import githubLogo from "@phosphor-icons/core/regular/github-logo.svg";
import globe from "@phosphor-icons/core/regular/globe.svg";
import info from "@phosphor-icons/core/regular/info.svg";
import key from "@phosphor-icons/core/regular/key.svg";
import link from "@phosphor-icons/core/regular/link.svg";
import lockSimple from "@phosphor-icons/core/regular/lock-simple.svg";
import magnifyingGlass from "@phosphor-icons/core/regular/magnifying-glass.svg";
import pause from "@phosphor-icons/core/regular/pause.svg";
import pencilSimple from "@phosphor-icons/core/regular/pencil-simple.svg";
import play from "@phosphor-icons/core/regular/play.svg";
import plus from "@phosphor-icons/core/regular/plus.svg";
import rocket from "@phosphor-icons/core/regular/rocket.svg";
import signOut from "@phosphor-icons/core/regular/sign-out.svg";
import square from "@phosphor-icons/core/regular/square.svg";
import squaresFour from "@phosphor-icons/core/regular/squares-four.svg";
import star from "@phosphor-icons/core/regular/star.svg";
import terminalWindow from "@phosphor-icons/core/regular/terminal-window.svg";
import trash from "@phosphor-icons/core/regular/trash.svg";
import uploadSimple from "@phosphor-icons/core/regular/upload-simple.svg";
import userPlus from "@phosphor-icons/core/regular/user-plus.svg";
import usersThree from "@phosphor-icons/core/regular/users-three.svg";
import warningCircle from "@phosphor-icons/core/regular/warning-circle.svg";
import warningOctagon from "@phosphor-icons/core/regular/warning-octagon.svg";
import webhooksLogo from "@phosphor-icons/core/regular/webhooks-logo.svg";
import x from "@phosphor-icons/core/regular/x.svg";

/** Every icon is a single <path> on a 256 × 256 grid. */
const path = (svg: string) => / d="([^"]+)"/.exec(svg)?.[1] ?? "";

const REGULAR = {
  "squares-four": squaresFour,
  database: database,
  "chart-line": chartLine,
  "cloud-arrow-up": cloudArrowUp,
  globe: globe,
  "clock-counter-clockwise": clockCounterClockwise,
  "users-three": usersThree,
  "terminal-window": terminalWindow,
  folder: folder,
  rocket: rocket,
  "brackets-curly": bracketsCurly,
  "cell-tower": cellTower,
  gear: gear,
  "warning-octagon": warningOctagon,
  gauge: gauge,
  play: play,
  "arrow-clockwise": arrowClockwise,
  square: square,
  "dots-three": dotsThree,
  copy: copy,
  eye: eye,
  "eye-slash": eyeSlash,
  trash: trash,
  plus: plus,
  "magnifying-glass": magnifyingGlass,
  "download-simple": downloadSimple,
  "upload-simple": uploadSimple,
  "arrow-square-out": arrowSquareOut,
  x: x,
  check: check,
  "caret-down": caretDown,
  "caret-left": caretLeft,
  "caret-right": caretRight,
  "warning-circle": warningCircle,
  "check-circle": checkCircle,
  info: info,
  "folder-open": folderOpen,
  file: file,
  "pencil-simple": pencilSimple,
  star: star,
  "github-logo": githubLogo,
  link: link,
  "sign-out": signOut,
  "arrow-right": arrowRight,
  broom: broom,
  "git-branch": gitBranch,
  pause: pause,
  "webhooks-logo": webhooksLogo,
  "file-plus": filePlus,
  "folder-plus": folderPlus,
  "lock-simple": lockSimple,
  certificate: certificate,
  key: key,
  "user-plus": userPlus,
};

const FILL = {
  "squares-four": squaresFourFill,
  database: databaseFill,
  "chart-line": chartLineFill,
  "cloud-arrow-up": cloudArrowUpFill,
  globe: globeFill,
  "clock-counter-clockwise": clockCounterClockwiseFill,
  "users-three": usersThreeFill,
  "terminal-window": terminalWindowFill,
  folder: folderFill,
  rocket: rocketFill,
  "brackets-curly": bracketsCurlyFill,
  "cell-tower": cellTowerFill,
  gear: gearFill,
  "warning-octagon": warningOctagonFill,
  gauge: gaugeFill,
  // Not a nav item: the filled star marks a favorite.
  star: starFill,
};

export type IconName = keyof typeof REGULAR;
/** The nav icons, which have a fill weight for the active item. */
export type NavIconName = keyof typeof FILL;

/** Which icon stands for which section, as on the site. */
export const NAV_ICON = {
  applications: "squares-four",
  databases: "database",
  metrics: "chart-line",
  blob: "cloud-arrow-up",
  domains: "globe",
  snapshots: "clock-counter-clockwise",
  workspaces: "users-three",
  logs: "terminal-window",
  files: "folder",
  deploys: "rocket",
  env: "brackets-curly",
  network: "cell-tower",
  settings: "gear",
  errors: "warning-octagon",
  performance: "gauge",
} as const satisfies Record<string, NavIconName>;

/** The path data of `name`, filled when asked and available. */
export function iconPath(name: IconName, fill = false): string {
  const svg = (fill && FILL[name as NavIconName]) || REGULAR[name];
  return path(svg);
}
