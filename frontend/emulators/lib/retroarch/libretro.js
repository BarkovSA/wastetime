/**
 * RetroArch Web Player
 *
 * This provides the basic JavaScript for the RetroArch web player.
 */

const defaultCore = "gambatte";
var autoStart = false;

var BrowserFS = BrowserFS;
var afs;
var zipTOC;
var initializationCount = 0;
var Module;
var currentCore;
var reloadTimeout;
var retroArchRunning = false;
var canvas = document.getElementById("canvas");

function modulePreRun(module) {
   module.ENV["LIBRARY_PATH"] = module.corePath;
}

var ModuleBase = {
   noInitialRun: true,
   retroArchSend: function(msg) {
      this.EmscriptenSendCommand(msg);
   },
   retroArchRecv: function() {
      return this.EmscriptenReceiveCommandReply();
   },
   retroArchExit: function(core, content) {
      relaunch(core, content);
   },
   onRuntimeInitialized: function() {
      appInitialized();
   },
   print: function(text) {
      console.log("stdout:", text);
   },
   printErr: function(text) {
      console.log("stderr:", text);
   },
   canvas: canvas
};

function cleanupStorage() {
   localStorage.clear();
   if (BrowserFS.FileSystem.IndexedDB.isAvailable()) {
      var req = indexedDB.deleteDatabase("RetroArch");
      req.onsuccess = function() {
         console.log("Deleted database successfully");
      };
      req.onerror = function() {
         console.error("Couldn't delete database");
      };
      req.onblocked = function() {
         console.error("Couldn't delete database due to the operation being blocked");
      };
   }

   document.getElementById("btnClean").disabled = true;
}

function idbfsInit() {
   var imfs = new BrowserFS.FileSystem.InMemory();
   if (BrowserFS.FileSystem.IndexedDB.isAvailable()) {
      afs = new BrowserFS.FileSystem.AsyncMirror(imfs,
         new BrowserFS.FileSystem.IndexedDB(function(e, fs) {
               if (e) {
                  // fallback to imfs
                  afs = new BrowserFS.FileSystem.InMemory();
                  console.error("WEBPLAYER: error: " + e + " falling back to in-memory filesystem");
                  appInitialized();
               } else {
                  // initialize afs by copying files from async storage to sync storage.
                  afs.initialize(function(e) {
                     if (e) {
                        afs = new BrowserFS.FileSystem.InMemory();
                        console.error("WEBPLAYER: error: " + e + " falling back to in-memory filesystem");
                        appInitialized();
                     } else {
                        console.log("WEBPLAYER: idbfs setup successful");
                        appInitialized();
                     }
                  });
               }
            },
            "RetroArch"));
   }
}

function zipfsInit() {
   // 256 MB max bundle size
   let buffer = new ArrayBuffer(256 * 1024 * 1024);
   let bufferView = new Uint8Array(buffer);
   let idx = 0;
   // bundle should be in five parts (this can be changed later)
   Promise.all([fetch("assets/frontend/bundle.zip.aa"),
      fetch("assets/frontend/bundle.zip.ab"),
      fetch("assets/frontend/bundle.zip.ac"),
      fetch("assets/frontend/bundle.zip.ad"),
      fetch("assets/frontend/bundle.zip.ae")
   ]).then(function(resps) {
      Promise.all(resps.map((r) => r.arrayBuffer())).then(function(buffers) {
         for (let buf of buffers) {
            if (idx + buf.byteLength > buffer.maxByteLength) {
               console.error("WEBPLAYER: error: bundle.zip is too large");
            }
            bufferView.set(new Uint8Array(buf), idx, buf.byteLength);
            idx += buf.byteLength;
         }
         BrowserFS.FileSystem.ZipFS.computeIndex(BrowserFS.BFSRequire('buffer').Buffer(new Uint8Array(buffer, 0, idx)), function(toc) {
            zipTOC = toc;
            console.log("WEBPLAYER: zipfs setup successful");
            appInitialized();
         });
      })
   });
}

function appInitialized() {
   /* Need to wait for the file system, the wasm runtime, and the zip download
      to complete before enabling the Run button. */
   initializationCount++;
   if (initializationCount == 3) {
      // Check if we need to pre-load ROM before setting up filesystem
      const hasAutoLoad = localStorage.getItem("autoLoadRom") && localStorage.getItem("autoLoadPlatform");
      
      if (hasAutoLoad) {
         // Pre-load ROM FIRST, then setup filesystem and complete
         preloadRomThenSetupFS();
      } else {
         // No auto-load, proceed normally
         setupFileSystem();
         preLoadingComplete();
      }
   }
}

function preloadRomThenSetupFS() {
   const autoLoadRom = localStorage.getItem("autoLoadRom");
   const autoLoadPlatform = localStorage.getItem("autoLoadPlatform");
   
   console.log('WEBPLAYER: Pre-loading ROM during initialization - rom:', autoLoadRom, 'platform:', autoLoadPlatform);
   
   // Clear the flags
   localStorage.removeItem("autoLoadRom");
   localStorage.removeItem("autoLoadPlatform");
   
   const romUrl = '/roms/' + autoLoadPlatform + '/' + encodeURIComponent(autoLoadRom);
   console.log('WEBPLAYER: Fetching ROM from:', romUrl);
   
   fetch(romUrl)
      .then(response => {
         console.log('WEBPLAYER: Fetch response status:', response.status);
         if (!response.ok) {
            throw new Error('ROM not found: ' + romUrl);
         }
         return response.arrayBuffer();
      })
      .then(data => {
         console.log('WEBPLAYER: ROM downloaded, size:', data.byteLength, 'bytes');
         
         // Store ROM data globally to write after FS is mounted  
         window.preloadedRomData = new Uint8Array(data);
         window.preloadedRomName = autoLoadRom;
         window.autoLoadRomPath = '/home/web_user/retroarch/userdata/content/' + autoLoadRom;
         
         console.log('WEBPLAYER: ROM pre-loaded successfully, now setting up filesystem...');
         
         // Setup filesystem and complete initialization
         setupFileSystem();
      })
      .catch(error => {
         console.error('WEBPLAYER: Failed to pre-load ROM:', error);
         // Continue anyway without auto-load
         setupFileSystem();
      })
      .finally(() => {
         // Always call preLoadingComplete exactly once, after setupFileSystem
         preLoadingComplete();
      });
}

function preLoadingComplete() {
   $('#icnRun').removeClass('fa-spinner').removeClass('fa-spin');
   $('#icnRun').addClass('fa-play');

   // Check if we have pre-loaded ROM data
   const hasAutoLoad = window.preloadedRomData && window.preloadedRomName;
   
   if (autoStart || hasAutoLoad) {
      console.log('WEBPLAYER: Auto-starting RetroArch...');
      
      // Load core if we skipped it earlier due to auto-load
      if (hasAutoLoad && currentCore) {
         console.log('WEBPLAYER: Loading core for auto-start:', currentCore);
         loadCore(currentCore);
      }
      
      startRetroArch();
   } else {
      // Make the Preview image clickable to start RetroArch.
      $('.webplayer-preview').addClass('loaded').click(function() {
         startRetroArch();
      });
      $('#btnRun').removeClass('disabled').removeAttr("disabled").click(function() {
         startRetroArch();
      });
   }
}

function mountBrowserFS() {
   var BFS = new BrowserFS.EmscriptenFS(Module.FS, Module.PATH, Module.ERRNO_CODES);
   Module.FS.mount(BFS, {
      root: '/home'
   }, '/home');

   // create fake core files for RetroArch
   Module.FS.writeFile("/home/web_user/retroarch/cores/" + currentCore + "_libretro.core", new Uint8Array());
   for (let core of Object.keys(libretroCores)) {
      Module.FS.writeFile("/home/web_user/retroarch/cores/" + core + "_libretro.core", new Uint8Array());
   }
   
   // Write pre-loaded ROM if available
   if (window.preloadedRomData && window.preloadedRomName) {
      console.log('WEBPLAYER: Writing pre-loaded ROM to mounted filesystem...');
      try {
         const romName = window.preloadedRomName;
         const romData = window.preloadedRomData;
         
         Module.FS.createDataFile('/', romName, romData, true, false);
         var fileData = Module.FS.readFile(romName, { encoding: 'binary' });
         Module.FS.writeFile('/home/web_user/retroarch/userdata/content/' + romName, fileData, { encoding: 'binary' });
         
         console.log('WEBPLAYER: ROM successfully written to:', window.autoLoadRomPath);
         
         // DON'T delete these yet - they're needed in preLoadingComplete()
         // They will be cleaned up after RetroArch starts
      } catch(error) {
         console.error('WEBPLAYER: Error writing ROM to filesystem:', error);
      }
   } else {
      console.log('WEBPLAYER: No pre-loaded ROM data found in mountBrowserFS');
   }
}

function setupFileSystem() {
   // create a mountable filesystem that will server as a root mountpoint for browserfs
   var mfs = new BrowserFS.FileSystem.MountableFileSystem();

   // create a ZipFS filesystem for the bundled data
   var zipfs = new BrowserFS.FileSystem.ZipFS(zipTOC);
   // create an XmlHttpRequest filesystem for core assets
   var xfs = new BrowserFS.FileSystem.XmlHttpRequest("index-xhr", "assets/cores/");

   mfs.mount('/home/web_user/retroarch', zipfs);
   mfs.mount('/home/web_user/retroarch/cores', new BrowserFS.FileSystem.InMemory());
   mfs.mount('/home/web_user/retroarch/userdata', afs);
   mfs.mount('/home/web_user/retroarch/userdata/content/downloads', xfs);
   BrowserFS.initialize(mfs);
   mountBrowserFS();

   console.log("WEBPLAYER: filesystem initialization successful");
}

function startRetroArch() {
   $('.webplayer').show();
   $('.webplayer-preview').hide();
   document.getElementById("btnRun").disabled = true;

   $('#btnAdd').removeClass("disabled").removeAttr("disabled").click(function() {
      $('#btnRom').click();
   });
   $('#btnRom').removeAttr("disabled").change(function(e) {
      selectFiles(e.target.files);
   });
   $('#btnMenu').removeClass("disabled").removeAttr("disabled").click(function() {
      Module.retroArchSend("MENU_TOGGLE");
      Module.canvas.focus();
   });
   $('#btnFullscreen').removeClass("disabled").removeAttr("disabled").click(function() {
      Module.retroArchSend("FULLSCREEN_TOGGLE");
      Module.canvas.focus();
   });

   // subsequent relaunches will start automatically
   ModuleBase.onRuntimeInitialized = function() {
      setTimeout(function() {
         mountBrowserFS();
         Module.callMain(Module.arguments);
         
         // Auto-focus canvas and enable audio after game starts
         setTimeout(function() {
            if (Module.canvas) {
               console.log('WEBPLAYER: Focusing canvas and enabling audio...');
               Module.canvas.focus();
               
               // Click canvas to enable audio context (browser requirement)
               Module.canvas.click();
               
               // Send unpause command to ensure game is running
               if (Module.retroArchSend) {
                  Module.retroArchSend("UNPAUSE");
               }
            }
         }, 1000); // Wait 1 second for game to load
      }, 0);
   };

   retroArchRunning = true;
   
   // Clean up global variables after RetroArch starts
   if (window.preloadedRomData) {
      delete window.preloadedRomData;
      delete window.preloadedRomName;
      delete window.autoLoadRomPath;
      console.log('WEBPLAYER: Auto-load complete, ROM should be running');
   }
   
   console.log('WEBPLAYER: RetroArch started, waiting for runtime initialization...');
   
   // Auto-enable audio context (required by browsers)
   setTimeout(function() {
      if (Module && Module.canvas) {
         console.log('WEBPLAYER: Auto-focusing canvas...');
         Module.canvas.focus();
         Module.canvas.click();
      }
   }, 2000);
}

function selectFiles(files) {
   $('#btnAdd').addClass('disabled');
   $('#icnAdd').removeClass('fa-plus');
   $('#icnAdd').addClass('fa-spinner spinning');
   var count = files.length;

   for (var i = 0; i < count; i++) {
      filereader = new FileReader();
      filereader.file_name = files[i].name;
      filereader.readAsArrayBuffer(files[i]);
      filereader.onload = function() {
         uploadData(this.result, this.file_name)
      };
      filereader.onloadend = function(evt) {
         console.log("WEBPLAYER: file: " + this.file_name + " upload complete");
         if (evt.target.readyState == FileReader.DONE) {
            $('#btnAdd').removeClass('disabled');
            $('#icnAdd').removeClass('fa-spinner spinning');
            $('#icnAdd').addClass('fa-plus');
         }
      }
   }
}

function uploadData(data, name) {
   var dataView = new Uint8Array(data);
   Module.FS.createDataFile('/', name, dataView, true, false);

   var data = Module.FS.readFile(name, {
      encoding: 'binary'
   });
   Module.FS.writeFile('/home/web_user/retroarch/userdata/content/' + name, data, {
      encoding: 'binary'
   });
   Module.FS.unlink(name);
}

// When the browser has loaded everything.
$(function() {
   // create core list
   var coreArray = Object.entries(libretroCores);
   var coreNames = Object.values(libretroCores).sort();
   var coreSelector = document.getElementById("core-selector");
   for (let name of coreNames) {
      let a = document.createElement("a");
      a.href = ".";
      a.dataset.core = coreArray.find(i => i[1] == name)[0];
      a.textContent = name;
      a.classList.add("dropdown-item");
      coreSelector.appendChild(a);
   }

   // Enable data clear
   $('#btnClean').click(function() {
      cleanupStorage();
   });

   // Enable all available ToolTips.
   $('.tooltip-enable').tooltip({
      placement: 'right'
   });

   // Allow hiding the top menu.
   $('.showMenu').hide();
   $('#btnHideMenu, .showMenu').click(function() {
      $('nav').slideToggle('slow');
      $('.showMenu').toggle('slow');
   });

   // Attempt to disable some default browser keys.
   var keys = {
      9: "tab",
      13: "enter",
      16: "shift",
      18: "alt",
      27: "esc",
      33: "rePag",
      34: "avPag",
      35: "end",
      36: "home",
      37: "left",
      38: "up",
      39: "right",
      40: "down",
      112: "F1",
      113: "F2",
      114: "F3",
      115: "F4",
      116: "F5",
      117: "F6",
      118: "F7",
      119: "F8",
      120: "F9",
      121: "F10",
      122: "F11",
      123: "F12"
   };
   window.addEventListener('keydown', function(e) {
      if (keys[e.which]) {
         e.preventDefault();
      }
   });

   // Switch the core when selecting one.
   $('#core-selector a').click(function(e) {
      e.preventDefault();
      var core = $(this).data('core');
      if (!core) return;
      localStorage.setItem("core", core);
      if (Module && retroArchRunning) {
         Module.retroArchSend("LOAD_CORE /home/web_user/retroarch/cores/" + core + "_libretro.core");

         // maybe RetroArch crashed? reload if RetroArch doesn't exit within a second.
         if (reloadTimeout) clearTimeout(reloadTimeout);
         reloadTimeout = setTimeout(function() {
            location.reload();
         }, 1000);
      } else {
         location.reload();
      }
   });

   // Find which core to load.
   currentCore = localStorage.getItem("core") || defaultCore;
   
   // Check for autoplay parameters in URL
   const urlParams = new URLSearchParams(window.location.search);
   const platform = urlParams.get('platform');
   const romFile = urlParams.get('rom');
   
   console.log('WEBPLAYER: URL params - platform:', platform, 'rom:', romFile);
   
   if (platform && romFile) {
      // Map platform to core
      const platformCoreMap = {
         'nes': 'nestopia',
         'snes': 'snes9x',
         'sega': 'genesis_plus_gx',
         'genesis': 'genesis_plus_gx',
         'megadrive': 'genesis_plus_gx',
         'gb': 'gambatte',
         'gbc': 'gambatte',
         'gba': 'mgba'
      };
      
      const autoCore = platformCoreMap[platform.toLowerCase()];
      console.log('WEBPLAYER: Mapped core:', autoCore);
      
      if (autoCore) {
         currentCore = autoCore;
         localStorage.setItem("core", currentCore);
         
         // Set flag for auto-loading ROM after emulator starts
         localStorage.setItem("autoLoadRom", romFile);
         localStorage.setItem("autoLoadPlatform", platform);
         
         console.log('WEBPLAYER: Auto-load flags set - core:', currentCore, 'rom:', romFile);
      }
   }
   
   // Only load core immediately if NOT auto-loading
   if (!window.autoLoadRomPath) {
      loadCore(currentCore);
   }

   // Start loading the filesystem
   idbfsInit();
   zipfsInit();
});

function loadCoreFallback(currentCore) {
   if (currentCore == defaultCore) {
      alert("Error: could not load default core!");
      return;
   }
   loadCore(defaultCore);
}

function loadCore(core, args) {
   // Make the core the selected core in the UI.
   $('#core-selector a.active').removeClass('active');
   var coreTitle = $('#core-selector a[data-core="' + core + '"]').addClass('active').text();
   $('#dropdownMenu1').text(coreTitle);

   // Check if we have auto-load ROM path
   if (window.autoLoadRomPath && !args) {
      console.log('WEBPLAYER: Loading core with auto-start ROM:', window.autoLoadRomPath);
      ModuleBase.arguments = ["-v", window.autoLoadRomPath, "-c", "/home/web_user/retroarch/userdata/retroarch.cfg"];
   } else {
      ModuleBase.arguments = args || ["-v", "--menu", "-c", "/home/web_user/retroarch/userdata/retroarch.cfg"];
   }
   
   ModuleBase.preRun = [modulePreRun];
   ModuleBase.canvas = canvas;
   ModuleBase.corePath = "/home/web_user/retroarch/cores/" + core + "_libretro.core";

   // Load the Core's related JavaScript.
   import("./" + core + "_libretro.js").then(script => {
      script.default(Object.assign({}, ModuleBase)).then(mod => {
         Module = mod;
      }).catch(err => {
         console.error("Couldn't instantiate module", err);
         loadCoreFallback(core);
         throw err;
      });
   }).catch(err => {
      console.error("Couldn't load script", err);
      loadCoreFallback(core);
      throw err;
   });
}

// exit/exitspawn hook
function relaunch(core, content) {
   // force restart on exit
   if (!core) core = ModuleBase.corePath;

   if (!content) content = "--menu";

   Module = null;
   if (reloadTimeout) {
      clearTimeout(reloadTimeout);
      reloadTimeout = null;
   }

   // parse core name from full path ("/home/web_user/retroarch/cores/NAME_libretro.core")
   currentCore = core.slice(0, -14).split("/").slice(-1)[0];

   localStorage.setItem("core", currentCore);
   loadCore(currentCore, ["-v", content, "-c", "/home/web_user/retroarch/userdata/retroarch.cfg"]);
}
