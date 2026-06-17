/* eslint-disable @typescript-eslint/no-require-imports */
const {
  app,
  BrowserWindow,
  Notification,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  net: electronNet,
  protocol,
  screen,
  shell,
} = require("electron");
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const tcpNet = require("net");
const path = require("path");
const { pathToFileURL } = require("url");

const DEFAULT_SHORTCUT = "CommandOrControl+Shift+S";
const METADATA_FILE = "metadata.json";
const SHOT_PROTOCOL = "shotbank";
const APP_ID = "com.monir.shotbank";

protocol.registerSchemesAsPrivileged([
  {
    scheme: SHOT_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

if (process.env.SHOTBANK_USER_DATA) {
  app.setPath("userData", process.env.SHOTBANK_USER_DATA);
}

app.setAppUserModelId(APP_ID);

let mainWindow;
let serverProcess;
let shortcutRegistered = false;

function appRoot() {
  return app.getAppPath();
}

function appIconPath() {
  return path.join(appRoot(), "build", "icon.ico");
}

function appConfigPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function defaultLibraryRoot() {
  if (process.env.SHOTBANK_LIBRARY_ROOT) {
    return process.env.SHOTBANK_LIBRARY_ROOT;
  }
  return path.join(app.getPath("pictures"), "ShotBank");
}

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readConfig() {
  const fallback = {
    libraryRoot: defaultLibraryRoot(),
    shortcut: DEFAULT_SHORTCUT,
    activeMovieId: null,
    lastCaptureAt: null,
  };
  return { ...fallback, ...readJson(appConfigPath(), fallback) };
}

function writeConfig(config) {
  writeJson(appConfigPath(), config);
}

function ensureLibraryRoot() {
  const config = readConfig();
  fs.mkdirSync(config.libraryRoot, { recursive: true });
  return config.libraryRoot;
}

function sanitizeFolderName(value) {
  return String(value || "Untitled Movie")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Untitled Movie";
}

function uniqueMovieFolder(input) {
  const root = ensureLibraryRoot();
  const title = sanitizeFolderName(input.title);
  const suffix = input.year ? ` (${input.year})` : "";
  const base = `${title}${suffix}`;
  let candidate = path.join(root, base);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(root, `${base} ${counter}`);
    counter += 1;
  }
  return candidate;
}

function metadataPath(movieFolder) {
  return path.join(movieFolder, METADATA_FILE);
}

function uniqueFilePath(folderPath, fileName) {
  const parsed = path.parse(fileName);
  let candidate = path.join(folderPath, fileName);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(folderPath, `${parsed.name}-${counter}${parsed.ext}`);
    counter += 1;
  }
  return candidate;
}

function isInsideLibrary(targetPath) {
  const libraryRoot = path.resolve(readConfig().libraryRoot);
  const resolvedTarget = path.resolve(targetPath);
  const relativePath = path.relative(libraryRoot, resolvedTarget);
  return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function encodeShotPath(filePath) {
  return Buffer.from(filePath, "utf8").toString("base64url");
}

function decodeShotPath(encodedPath) {
  return Buffer.from(encodedPath, "base64url").toString("utf8");
}

function shotFileUrl(filePath) {
  return `${SHOT_PROTOCOL}://shot/${encodeShotPath(filePath)}`;
}

function readMovieFromFolder(movieFolder) {
  const movie = readJson(metadataPath(movieFolder), null);
  if (!movie || !movie.id || !movie.title) return null;
  return enrichMovie(normalizeMovieStorage({ ...movie, folderPath: movieFolder }));
}

function enrichMovie(movie) {
  const shots = Array.isArray(movie.shots) ? movie.shots : [];
  return {
    ...movie,
    shots: shots.map((shot) => ({
      ...shot,
      fileUrl: shot.filePath ? shotFileUrl(shot.filePath) : null,
      exists: shot.filePath ? fs.existsSync(shot.filePath) : false,
    })),
  };
}

function normalizeMovieStorage(movie) {
  const oldShotsPath = path.join(movie.folderPath, "shots");
  const resolvedOldShotsPath = path.resolve(oldShotsPath).toLowerCase();
  let changed = movie.shotsPath !== movie.folderPath;

  const shots = Array.isArray(movie.shots) ? movie.shots : [];
  const nextShots = shots.map((shot) => {
    const nextShot = { ...shot };
    if (!nextShot.filePath && nextShot.relativePath) {
      nextShot.filePath = path.join(movie.folderPath, nextShot.relativePath);
      changed = true;
    }

    if (!nextShot.filePath) return nextShot;

    const resolvedFilePath = path.resolve(nextShot.filePath);
    const rootCandidate = path.join(movie.folderPath, path.basename(resolvedFilePath));
    const isNestedShot = path.dirname(resolvedFilePath).toLowerCase() === resolvedOldShotsPath;

    if (isNestedShot && fs.existsSync(resolvedFilePath)) {
      const targetPath = fs.existsSync(rootCandidate) ? uniqueFilePath(movie.folderPath, path.basename(resolvedFilePath)) : rootCandidate;
      fs.renameSync(resolvedFilePath, targetPath);
      nextShot.filePath = targetPath;
      nextShot.fileName = path.basename(targetPath);
      nextShot.relativePath = path.basename(targetPath);
      changed = true;
      return nextShot;
    }

    if (!fs.existsSync(resolvedFilePath) && fs.existsSync(rootCandidate)) {
      nextShot.filePath = rootCandidate;
      nextShot.fileName = path.basename(rootCandidate);
      changed = true;
    }

    if (nextShot.relativePath !== path.basename(nextShot.filePath)) {
      nextShot.relativePath = path.basename(nextShot.filePath);
      changed = true;
    }

    return nextShot;
  });

  const normalizedMovie = {
    ...movie,
    shotsPath: movie.folderPath,
    shots: nextShots,
  };

  if (changed) {
    writeMovie(normalizedMovie);
  }

  try {
    fs.rmdirSync(oldShotsPath);
  } catch {
    // Keep the folder if it still contains user files.
  }

  return normalizedMovie;
}

function registerShotProtocol() {
  protocol.handle(SHOT_PROTOCOL, async (request) => {
    try {
      const url = new URL(request.url);
      if (url.hostname !== "shot") {
        return new Response("Not found", { status: 404 });
      }

      const encodedPath = decodeURIComponent(url.pathname.replace(/^\//, ""));
      const filePath = decodeShotPath(encodedPath);
      if (!isInsideLibrary(filePath) || !fs.existsSync(filePath)) {
        return new Response("Not found", { status: 404 });
      }

      return electronNet.fetch(pathToFileURL(filePath).href);
    } catch {
      return new Response("Bad image request", { status: 400 });
    }
  });
}

function writeMovie(movie) {
  const cleanMovie = {
    ...movie,
    shots: (movie.shots || []).map((shot) => {
      const cleanShot = { ...shot };
      delete cleanShot.fileUrl;
      delete cleanShot.exists;
      return cleanShot;
    }),
  };
  writeJson(metadataPath(movie.folderPath), cleanMovie);
  return enrichMovie(cleanMovie);
}

function listMovies() {
  const root = ensureLibraryRoot();
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readMovieFromFolder(path.join(root, entry.name)))
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function findMovie(movieId) {
  return listMovies().find((movie) => movie.id === movieId) || null;
}

function getState() {
  const config = readConfig();
  const movies = listMovies();
  const activeMovie = movies.find((movie) => movie.id === config.activeMovieId) || null;
  return {
    config,
    movies,
    activeMovie,
    shortcutRegistered,
    isDesktop: true,
  };
}

function createMovie(input) {
  const timestamp = nowIso();
  const folderPath = uniqueMovieFolder(input);
  fs.mkdirSync(folderPath, { recursive: true });

  const movie = {
    id: crypto.randomUUID(),
    title: String(input.title || "Untitled Movie").trim() || "Untitled Movie",
    director: String(input.director || "").trim(),
    year: String(input.year || "").trim(),
    source: String(input.source || "").trim(),
    watchNote: String(input.watchNote || "").trim(),
    folderPath,
    shotsPath: folderPath,
    createdAt: timestamp,
    updatedAt: timestamp,
    shots: [],
  };

  writeMovie(movie);
  const config = readConfig();
  config.activeMovieId = movie.id;
  writeConfig(config);
  registerCaptureShortcut(config.shortcut);
  return getState();
}

function resumeMovie(movieId) {
  const movie = findMovie(movieId);
  if (!movie) throw new Error("Movie folder was not found.");
  const config = readConfig();
  config.activeMovieId = movie.id;
  writeConfig(config);
  return getState();
}

function endSession() {
  const config = readConfig();
  config.activeMovieId = null;
  writeConfig(config);
  return getState();
}

async function deleteMovie(movieId) {
  const movie = findMovie(movieId);
  if (!movie) throw new Error("Movie folder was not found.");

  const movieFolder = path.resolve(movie.folderPath);
  if (!isInsideLibrary(movieFolder)) {
    throw new Error("Refusing to delete a folder outside the ShotBank library.");
  }

  const config = readConfig();
  if (config.activeMovieId === movie.id) {
    config.activeMovieId = null;
    writeConfig(config);
  }

  await shell.trashItem(movieFolder);
  return getState();
}

async function captureActiveSession(trigger = "manual") {
  const state = getState();
  if (!state.activeMovie) {
    const message = "Start a movie session before capturing.";
    if (Notification.isSupported()) {
      new Notification({ title: "ShotBank", body: message }).show();
    }
    throw new Error(message);
  }

  const movie = state.activeMovie;
  fs.mkdirSync(movie.folderPath, { recursive: true });

  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point) || screen.getPrimaryDisplay();
  const size = display.size || screen.getPrimaryDisplay().size;
  const scaleFactor = display.scaleFactor || 1;
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.round(size.width * scaleFactor),
      height: Math.round(size.height * scaleFactor),
    },
  });

  const source =
    sources.find((item) => item.display_id === String(display.id)) ||
    sources.find((item) => item.name.toLowerCase().includes("screen")) ||
    sources[0];

  if (!source || source.thumbnail.isEmpty()) {
    throw new Error("Could not capture the screen.");
  }

  const capturedAt = nowIso();
  const stamp = capturedAt.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const filePath = uniqueFilePath(movie.folderPath, `shot-${stamp}.png`);
  const fileName = path.basename(filePath);
  fs.writeFileSync(filePath, source.thumbnail.toPNG());

  const shot = {
    id: crypto.randomUUID(),
    fileName,
    filePath,
    relativePath: fileName,
    capturedAt,
    trigger,
    notes: "",
    recreateNotes: "",
    tags: "",
    rating: 3,
  };

  const latestMovie = findMovie(movie.id) || movie;
  latestMovie.shots = [shot, ...(latestMovie.shots || [])];
  latestMovie.updatedAt = capturedAt;
  writeMovie(latestMovie);

  const config = readConfig();
  config.lastCaptureAt = capturedAt;
  writeConfig(config);

  const nextState = getState();
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("shotbank:shot-captured", { shot: enrichMovie({ shots: [shot] }).shots[0], state: nextState });
  }

  return nextState;
}

function updateShot(input) {
  const movie = findMovie(input.movieId);
  if (!movie) throw new Error("Movie folder was not found.");
  const shots = movie.shots || [];
  const shotIndex = shots.findIndex((shot) => shot.id === input.shotId);
  if (shotIndex === -1) throw new Error("Shot was not found.");

  shots[shotIndex] = {
    ...shots[shotIndex],
    notes: String(input.notes || ""),
    recreateNotes: String(input.recreateNotes || ""),
    tags: String(input.tags || ""),
    rating: Number(input.rating || 0),
    updatedAt: nowIso(),
  };
  movie.shots = shots;
  movie.updatedAt = nowIso();
  writeMovie(movie);
  return getState();
}

function updateMovie(input) {
  const movie = findMovie(input.movieId);
  if (!movie) throw new Error("Movie folder was not found.");
  movie.title = String(input.title || movie.title).trim() || movie.title;
  movie.director = String(input.director || "");
  movie.year = String(input.year || "");
  movie.source = String(input.source || "");
  movie.watchNote = String(input.watchNote || "");
  movie.updatedAt = nowIso();
  writeMovie(movie);
  return getState();
}

function registerCaptureShortcut(accelerator) {
  globalShortcut.unregisterAll();
  shortcutRegistered = false;
  const shortcut = String(accelerator || DEFAULT_SHORTCUT).trim() || DEFAULT_SHORTCUT;
  shortcutRegistered = globalShortcut.register(shortcut, () => {
    captureActiveSession("shortcut").catch((error) => {
      if (Notification.isSupported()) {
        new Notification({ title: "ShotBank capture failed", body: error.message }).show();
      }
    });
  });
  return shortcutRegistered;
}

function setShortcut(accelerator) {
  const config = readConfig();
  const previous = config.shortcut || DEFAULT_SHORTCUT;
  const nextShortcut = String(accelerator || "").trim();
  if (!nextShortcut) throw new Error("Shortcut cannot be empty.");
  config.shortcut = nextShortcut;
  writeConfig(config);

  if (!registerCaptureShortcut(nextShortcut)) {
    config.shortcut = previous;
    writeConfig(config);
    registerCaptureShortcut(previous);
    throw new Error(`Could not register shortcut: ${nextShortcut}`);
  }

  return getState();
}

async function chooseLibraryRoot() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose ShotBank library folder",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return getState();
  const config = readConfig();
  config.libraryRoot = result.filePaths[0];
  config.activeMovieId = null;
  writeConfig(config);
  fs.mkdirSync(config.libraryRoot, { recursive: true });
  return getState();
}

async function openPath(targetPath) {
  if (!targetPath) return;
  await shell.openPath(targetPath);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = tcpNet.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 3000;
      server.close(() => resolve(port));
    });
  });
}

function waitForServer(url) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timeoutMs = 30000;
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(check, 500);
      });
    };
    check();
  });
}

async function startServer() {
  const root = appRoot();
  const standaloneRoot = path.join(root, ".next", "standalone");
  const serverPath = path.join(standaloneRoot, "server.js");
  const port = await getFreePort();

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: standaloneRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
    stdio: "ignore",
    windowsHide: true,
  });

  serverProcess.on("exit", (code) => {
    if (code !== 0 && mainWindow) {
      mainWindow.webContents.loadURL(
        `data:text/plain,ShotBank server stopped unexpectedly. Exit code: ${code}`,
      );
    }
  });

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 920,
    minWidth: 1100,
    minHeight: 760,
    title: "ShotBank",
    backgroundColor: "#09090b",
    icon: appIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL(url);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle("shotbank:get-state", () => getState());
  ipcMain.handle("shotbank:start-movie", (_event, input) => createMovie(input || {}));
  ipcMain.handle("shotbank:resume-movie", (_event, movieId) => resumeMovie(movieId));
  ipcMain.handle("shotbank:delete-movie", (_event, movieId) => deleteMovie(movieId));
  ipcMain.handle("shotbank:end-session", () => endSession());
  ipcMain.handle("shotbank:capture-now", () => captureActiveSession("manual"));
  ipcMain.handle("shotbank:update-shot", (_event, input) => updateShot(input || {}));
  ipcMain.handle("shotbank:update-movie", (_event, input) => updateMovie(input || {}));
  ipcMain.handle("shotbank:set-shortcut", (_event, accelerator) => setShortcut(accelerator));
  ipcMain.handle("shotbank:choose-library-root", () => chooseLibraryRoot());
  ipcMain.handle("shotbank:open-path", (_event, targetPath) => openPath(targetPath));
}

async function runSelfTest() {
  const resultPath =
    process.env.SHOTBANK_SELF_TEST_RESULT || path.join(app.getPath("temp"), "shotbank-self-test.json");

  createMovie({
    title: `ShotBank Self Test ${Date.now()}`,
    source: "self-test",
    watchNote: "Temporary capture check.",
  });

  const state = await captureActiveSession("self-test");
  const movie = state.activeMovie;
  const firstShot = movie?.shots?.[0] || null;
  const result = {
    ok: Boolean(movie && firstShot && firstShot.exists),
    libraryRoot: state.config.libraryRoot,
    movieId: movie?.id || null,
    folderPath: movie?.folderPath || null,
    metadataPath: movie?.folderPath ? metadataPath(movie.folderPath) : null,
    shotCount: movie?.shots?.length || 0,
    firstShotPath: firstShot?.filePath || null,
    firstShotUrl: firstShot?.fileUrl || null,
    shotInMovieFolder: Boolean(movie && firstShot && path.dirname(firstShot.filePath) === movie.folderPath),
  };

  if (process.env.SHOTBANK_SELF_TEST_PROTOCOL === "1" && firstShot?.fileUrl) {
    const imageResponse = await electronNet.fetch(firstShot.fileUrl);
    const imageBytes = (await imageResponse.arrayBuffer()).byteLength;
    result.protocolOk = imageResponse.ok && imageBytes > 0;
    result.protocolBytes = imageBytes;
    result.ok = result.ok && result.protocolOk;
  }

  if (process.env.SHOTBANK_SELF_TEST_MIGRATE === "1" && firstShot?.filePath) {
    const legacyFolder = path.join(state.config.libraryRoot, `Legacy Self Test ${Date.now()}`);
    const legacyShotsFolder = path.join(legacyFolder, "shots");
    const legacyShotPath = path.join(legacyShotsFolder, "legacy-shot.png");
    fs.mkdirSync(legacyShotsFolder, { recursive: true });
    fs.copyFileSync(firstShot.filePath, legacyShotPath);
    writeJson(metadataPath(legacyFolder), {
      id: crypto.randomUUID(),
      title: path.basename(legacyFolder),
      director: "",
      year: "",
      source: "self-test",
      watchNote: "Legacy nested shot folder migration check.",
      folderPath: legacyFolder,
      shotsPath: legacyShotsFolder,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      shots: [
        {
          id: crypto.randomUUID(),
          fileName: "legacy-shot.png",
          filePath: legacyShotPath,
          relativePath: path.join("shots", "legacy-shot.png"),
          capturedAt: nowIso(),
          trigger: "self-test",
          notes: "",
          recreateNotes: "",
          tags: "",
          rating: 3,
        },
      ],
    });

    const migratedMovie = readMovieFromFolder(legacyFolder);
    const migratedShot = migratedMovie?.shots?.[0] || null;
    result.migrationOk = Boolean(
      migratedMovie &&
        migratedShot &&
        path.dirname(migratedShot.filePath) === legacyFolder &&
        fs.existsSync(migratedShot.filePath) &&
        !fs.existsSync(legacyShotPath),
    );
    result.migratedShotPath = migratedShot?.filePath || null;
    result.ok = result.ok && result.migrationOk;
  }

  if (process.env.SHOTBANK_SELF_TEST_DELETE === "1" && movie) {
    await deleteMovie(movie.id);
    result.deleted = !fs.existsSync(movie.folderPath);
    result.ok = result.ok && result.deleted;
  }

  writeJson(resultPath, result);
  if (!result.ok) {
    throw new Error("ShotBank self-test did not create a local screenshot.");
  }
}

function stopServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
}

app.whenReady().then(async () => {
  try {
    registerShotProtocol();
    ensureLibraryRoot();

    if (process.env.SHOTBANK_SELF_TEST === "1") {
      await runSelfTest();
      app.quit();
      return;
    }

    registerIpc();
    registerCaptureShortcut(readConfig().shortcut);
    const url = await startServer();
    createWindow(url);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
    });
  } catch (error) {
    if (process.env.SHOTBANK_SELF_TEST_RESULT) {
      writeJson(process.env.SHOTBANK_SELF_TEST_RESULT, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    console.error(error);
    app.exit(1);
  }
});

app.on("before-quit", () => {
  globalShortcut.unregisterAll();
  stopServer();
});
app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});
