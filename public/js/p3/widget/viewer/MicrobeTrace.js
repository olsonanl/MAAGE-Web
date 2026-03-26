/**
 * MicrobeTrace Viewer Widget
 *
 * This viewer provides a landing page for opening workspace files in the CDC's
 * MicrobeTrace molecular epidemiology visualization tool. Files are opened in
 * a new browser tab using MicrobeTrace's partner handoff system.
 *
 * Supported file types: FASTA, CSV, TSV, Newick trees, and MicrobeTrace sessions.
 *
 * @see https://github.com/CDCgov/MicrobeTrace
 */
define([
  'dojo/_base/declare',
  'dijit/layout/BorderContainer',
  'dijit/layout/ContentPane',
  'dojo/on',
  'dojo/dom-construct',
  'dojo/dom-class',
  'dojo/_base/lang',
  'dojo/topic',
  '../../WorkspaceManager',
  '../../util/encodePath',
  '../formatter'
], function (
  declare,
  BorderContainer,
  ContentPane,
  on,
  domConstruct,
  domClass,
  lang,
  Topic,
  WorkspaceManager,
  encodePath,
  formatter
) {
  return declare([BorderContainer], {
    baseClass: 'MicrobeTraceViewer',
    disabled: false,
    containerType: 'microbetrace_session',
    gutters: false,

    // Supported input file types for MicrobeTrace
    supportedTypes: [
      'fasta', 'fa', 'fna', 'faa',
      'csv', 'tsv',
      'nwk', 'newick',
      'json', 'microbetrace', 'microbetrace_session'
    ],

    // Internal state
    _workspacePath: null,
    _fileContent: null,
    _filename: null,
    _fileType: null,

    /**
     * _setStateAttr - Called when the viewer receives state from router
     */
    _setStateAttr: function (state) {
      this._set('state', state);
      if (!state) return;

      console.log('[MicrobeTrace] _setStateAttr received state:', JSON.stringify(state));

      // Extract workspace path from state.pathname
      // pathname is like /view/MicrobeTrace/user@domain/path/to/file.nwk
      var path = state.pathname;
      if (path) {
        // Remove /view/MicrobeTrace prefix to get the workspace path
        // Handle both /view/MicrobeTrace and /MicrobeTrace prefixes
        path = path.replace(/^\/view\/MicrobeTrace/, '').replace(/^\/MicrobeTrace/, '');
        // Ensure path starts with /
        if (path && !path.startsWith('/')) {
          path = '/' + path;
        }
      }

      // Also check state.path and state.value as fallbacks
      if (!path) {
        path = state.path || state.value;
      }

      if (!path) {
        console.warn('[MicrobeTrace] No path found in state:', state);
        return;
      }

      console.log('[MicrobeTrace] Extracted path:', path);

      // URL decode the path to handle encoded characters
      try {
        path = decodeURIComponent(path);
        console.log('[MicrobeTrace] Decoded path:', path);
      } catch (e) {
        console.warn('[MicrobeTrace] Could not decode path:', e);
      }

      console.log('[MicrobeTrace] Loading file from path:', path);
      this._workspacePath = path;

      // Defer loading until startup completes
      if (this._started) {
        this._loadFileInfo(path);
      }
      // If not started yet, startup() will call _loadFileInfo
    },

    /**
     * _setDataAttr - Called when viewing a workspace object directly
     */
    _setDataAttr: function (data) {
      this._set('data', data);
      if (!data) return;

      // Extract path from workspace object metadata
      var meta = data.metadata || data;
      var path = meta.path;
      if (meta.name && path) {
        path = path + (path.endsWith('/') ? '' : '/') + meta.name;
      }

      if (path) {
        this._workspacePath = path;
        // Defer loading until startup completes
        if (this._started) {
          this._loadFileInfo(path);
        }
        // If not started yet, startup() will call _loadFileInfo
      }
    },

    startup: function () {
      if (this._started) return;
      this.inherited(arguments);
      this._setupUI();

      // If state was set before startup, load now
      if (this._workspacePath) {
        this._loadFileInfo(this._workspacePath);
      }
    },

    /**
     * _setupUI - Create the main content pane
     */
    _setupUI: function () {
      // Main content pane for the landing page
      this.contentPane = new ContentPane({
        region: 'center',
        style: 'padding: 0; overflow: auto; background: #f8f9fa;'
      });
      this.addChild(this.contentPane);
    },

    /**
     * _loadFileInfo - Load file info and show landing page
     */
    _loadFileInfo: function (workspacePath) {
      var _self = this;

      // Show loading indicator
      this._showLoading();

      var filename = workspacePath.split('/').pop();
      var ext = this._getFileExtension(filename);

      console.log('[MicrobeTrace] Loading file via WorkspaceManager.getObject:', workspacePath);

      // Use WorkspaceManager.getObject to properly handle authentication and shock links
      WorkspaceManager.getObject(workspacePath, false).then(function (result) {
        console.log('[MicrobeTrace] Got object result:', result);

        var fileContent = result.data;

        // Handle if data is an object (JSON) - stringify it
        if (typeof fileContent === 'object' && fileContent !== null) {
          fileContent = JSON.stringify(fileContent);
        }

        if (!fileContent || typeof fileContent !== 'string') {
          throw new Error('No file content returned');
        }

        console.log('[MicrobeTrace] File content loaded, size:', fileContent.length);
        console.log('[MicrobeTrace] File content first 100 chars:', fileContent.substring(0, 100));

        // Store file info for later use
        _self._filename = filename;
        _self._fileType = ext;
        _self._fileContent = fileContent;

        // Determine the file kind for MicrobeTrace
        var kind = _self._inferFileKind(ext, fileContent, filename);

        // Show the landing page
        _self._showLandingPage(filename, ext, kind, fileContent.length);
      }).catch(function (err) {
        console.error('[MicrobeTrace] Failed to load file:', err);
        _self._showError('Failed to load file: ' + (err.message || err));
      });
    },

    /**
     * _showLandingPage - Display landing page with file info and Open button
     */
    _showLandingPage: function (filename, fileType, kind, fileSize) {
      var _self = this;
      domConstruct.empty(this.contentPane.domNode);

      // Create centered landing page container
      var container = domConstruct.create('div', {
        style: 'display: flex; flex-direction: column; align-items: center; justify-content: center; ' +
               'min-height: 100%; padding: 40px; box-sizing: border-box;'
      }, this.contentPane.domNode);

      // MicrobeTrace logo/icon card
      var card = domConstruct.create('div', {
        style: 'background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); ' +
               'padding: 40px 60px; text-align: center; max-width: 500px; width: 100%;'
      }, container);

      // MicrobeTrace icon
      domConstruct.create('div', {
        innerHTML: '<i class="fa icon-network" style="font-size: 64px; color: #17a2b8;"></i>',
        style: 'margin-bottom: 20px;'
      }, card);

      // Title
      domConstruct.create('h2', {
        innerHTML: 'MicrobeTrace',
        style: 'margin: 0 0 8px 0; font-size: 28px; color: #212529; font-weight: 600;'
      }, card);

      // Subtitle
      domConstruct.create('p', {
        innerHTML: 'Molecular Epidemiology Visualization Tool',
        style: 'margin: 0 0 30px 0; color: #6c757d; font-size: 14px;'
      }, card);

      // File info section
      var fileInfo = domConstruct.create('div', {
        style: 'background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px; text-align: left;'
      }, card);

      // File icon and name
      var iconClass = this._getIconForFileType(fileType);
      domConstruct.create('div', {
        innerHTML: '<i class="' + iconClass + '" style="margin-right: 10px; color: #495057;"></i>' +
                   '<strong>' + this._escapeHtml(filename) + '</strong>',
        style: 'font-size: 16px; margin-bottom: 12px; color: #212529;'
      }, fileInfo);

      // File details
      var details = [];
      details.push('<strong>Type:</strong> ' + this._getFileTypeLabel(kind));
      details.push('<strong>Size:</strong> ' + this._formatFileSize(fileSize));

      domConstruct.create('div', {
        innerHTML: details.join('<br>'),
        style: 'font-size: 13px; color: #6c757d; line-height: 1.6;'
      }, fileInfo);

      // Open in MicrobeTrace button
      var openBtn = domConstruct.create('button', {
        innerHTML: '<i class="fa icon-external-link" style="margin-right: 8px;"></i>Open in MicrobeTrace',
        style: 'background: #17a2b8; color: white; border: none; padding: 14px 32px; ' +
               'border-radius: 6px; font-size: 16px; cursor: pointer; font-weight: 500; ' +
               'transition: background 0.2s; width: 100%;'
      }, card);

      on(openBtn, 'click', lang.hitch(this, '_openInMicrobeTrace'));
      on(openBtn, 'mouseenter', function () { this.style.background = '#138496'; });
      on(openBtn, 'mouseleave', function () { this.style.background = '#17a2b8'; });

      // Help text
      domConstruct.create('p', {
        innerHTML: 'MicrobeTrace will open in a new browser tab with your file loaded.',
        style: 'margin: 20px 0 0 0; color: #6c757d; font-size: 12px;'
      }, card);

      // Info about MicrobeTrace
      var infoSection = domConstruct.create('div', {
        style: 'margin-top: 30px; text-align: left; max-width: 500px; width: 100%;'
      }, container);

      domConstruct.create('h4', {
        innerHTML: 'About MicrobeTrace',
        style: 'margin: 0 0 10px 0; font-size: 14px; color: #495057; font-weight: 600;'
      }, infoSection);

      domConstruct.create('p', {
        innerHTML: 'MicrobeTrace is an open-source tool developed by the CDC for visualizing and analyzing ' +
                   'molecular epidemiology data. It supports network visualization, phylogenetic trees, ' +
                   'geographic mapping, and more.',
        style: 'margin: 0; color: #6c757d; font-size: 13px; line-height: 1.6;'
      }, infoSection);
    },

    /**
     * _openInMicrobeTrace - Open MicrobeTrace in a new tab with the file data
     *
     * Uses MicrobeTrace's partner handoff receiver page, which properly handles
     * storing data via localforage before redirecting to the main app.
     */
    _openInMicrobeTrace: function () {
      var _self = this;

      if (!this._fileContent) {
        Topic.publish('/Notification', {
          message: 'File content not loaded. Please try again.',
          type: 'error'
        });
        return;
      }

      // Trim the file content and check what we have
      var fileContent = this._fileContent.trim();
      console.log('[MicrobeTrace] File content first 200 chars:', JSON.stringify(fileContent.substring(0, 200)));
      console.log('[MicrobeTrace] File content starts with:', fileContent.charAt(0));

      // Determine the file kind for MicrobeTrace
      var kind = this._inferFileKind(this._fileType, fileContent, this._filename);
      console.log('[MicrobeTrace] Inferred kind:', kind);

      // Generate unique identifiers for the handoff
      var partnerId = 'maage';
      var nonce = 'maage-' + Date.now() + '-' + Math.random().toString(16).slice(2);

      // Create the handoff payload matching MicrobeTrace's expected format
      var payload = {
        type: 'MT_HANDOFF_TRANSFER',
        version: 1,
        partnerId: partnerId,
        nonce: nonce,
        metadata: {
          datasetName: this._filename,
          sourceApp: 'MAAGE'
        },
        files: [{
          name: this._filename,
          kind: kind,
          contents: fileContent
        }]
      };

      console.log('[MicrobeTrace] Opening receiver with partnerId:', partnerId, 'nonce:', nonce);

      // Open the receiver.html page which will handle the handoff
      var receiverUrl = '/microbetrace/assets/embed/receiver.html?partnerId=' +
                        encodeURIComponent(partnerId) + '&nonce=' + encodeURIComponent(nonce);

      var receiverWindow = window.open(receiverUrl, '_blank');

      if (!receiverWindow) {
        Topic.publish('/Notification', {
          message: 'Could not open popup. Please allow popups for this site.',
          type: 'error'
        });
        return;
      }

      // Listen for the READY message from the receiver
      var messageHandler = function(event) {
        console.log('[MicrobeTrace] Received message:', event.data);

        if (!event.data || event.data.type !== 'MT_HANDOFF_READY') {
          return;
        }

        // Verify it's from our receiver
        if (event.data.partnerId !== partnerId || event.data.nonce !== nonce) {
          console.log('[MicrobeTrace] Ignoring message with different partnerId/nonce');
          return;
        }

        console.log('[MicrobeTrace] Receiver is ready, sending payload');

        // Send the payload to the receiver
        try {
          receiverWindow.postMessage(payload, '*');
          console.log('[MicrobeTrace] Payload sent');
        } catch (e) {
          console.error('[MicrobeTrace] Failed to send payload:', e);
        }
      };

      // Set up message listener
      window.addEventListener('message', messageHandler);

      // Clean up after 60 seconds
      setTimeout(function() {
        window.removeEventListener('message', messageHandler);
      }, 60000);

      // Also listen for the stored confirmation
      var storedHandler = function(event) {
        if (!event.data || event.data.type !== 'MT_HANDOFF_TRANSFER' || event.data.status !== 'stored') {
          return;
        }

        if (event.data.partnerId !== partnerId || event.data.nonce !== nonce) {
          return;
        }

        console.log('[MicrobeTrace] Handoff stored successfully with ID:', event.data.handoffId);
        window.removeEventListener('message', storedHandler);

        Topic.publish('/Notification', {
          message: 'MicrobeTrace loaded with ' + _self._filename,
          type: 'success'
        });
      };

      window.addEventListener('message', storedHandler);

      // Clean up stored handler after 60 seconds
      setTimeout(function() {
        window.removeEventListener('message', storedHandler);
      }, 60000);

      Topic.publish('/Notification', {
        message: 'Opening MicrobeTrace with ' + this._filename,
        type: 'info'
      });
    },

    /**
     * _storeInLocalForage - Store data in IndexedDB using localforage's structure
     *
     * localforage defaults: database='localforage', store='keyvaluepairs'
     */
    _storeInLocalForage: function (key, value) {
      return new Promise(function (resolve, reject) {
        // First check if localforage database exists and get its version
        if (indexedDB.databases) {
          indexedDB.databases().then(function(databases) {
            console.log('[MicrobeTrace] Existing databases:', databases);
            var lfDb = databases.find(function(db) { return db.name === 'localforage'; });
            if (lfDb) {
              console.log('[MicrobeTrace] localforage database exists with version:', lfDb.version);
              openWithVersion(lfDb.version);
            } else {
              console.log('[MicrobeTrace] localforage database does not exist, creating new');
              openWithVersion(undefined);
            }
          }).catch(function() {
            // databases() not supported, try opening without version
            openWithVersion(undefined);
          });
        } else {
          openWithVersion(undefined);
        }

        function openWithVersion(version) {
          var request;
          if (version !== undefined) {
            request = indexedDB.open('localforage', version);
          } else {
            request = indexedDB.open('localforage');
          }

          request.onerror = function (event) {
            console.error('[MicrobeTrace] IndexedDB open error:', event.target.error);
            reject(new Error('Could not open IndexedDB: ' + event.target.error));
          };

          request.onupgradeneeded = function (event) {
            console.log('[MicrobeTrace] Creating localforage database structure');
            var db = event.target.result;
            if (!db.objectStoreNames.contains('keyvaluepairs')) {
              db.createObjectStore('keyvaluepairs');
            }
          };

          request.onsuccess = function (event) {
            var db = event.target.result;
            console.log('[MicrobeTrace] IndexedDB opened, version:', db.version, 'stores:', Array.from(db.objectStoreNames));

            // Check if keyvaluepairs store exists
            if (!db.objectStoreNames.contains('keyvaluepairs')) {
              console.error('[MicrobeTrace] keyvaluepairs store does not exist!');
              db.close();
              reject(new Error('keyvaluepairs store not found'));
              return;
            }

            try {
              var transaction = db.transaction(['keyvaluepairs'], 'readwrite');
              var store = transaction.objectStore('keyvaluepairs');

              console.log('[MicrobeTrace] Putting data with key:', key);
              var putRequest = store.put(value, key);

              putRequest.onerror = function (event) {
                console.error('[MicrobeTrace] IndexedDB put error:', event.target.error);
                db.close();
                reject(new Error('Failed to store data: ' + event.target.error));
              };

              putRequest.onsuccess = function () {
                console.log('[MicrobeTrace] Put succeeded');
              };

              transaction.oncomplete = function () {
                console.log('[MicrobeTrace] Transaction complete, verifying...');

                // Verify the data was stored
                var verifyTx = db.transaction(['keyvaluepairs'], 'readonly');
                var verifyStore = verifyTx.objectStore('keyvaluepairs');
                var getRequest = verifyStore.get(key);

                getRequest.onsuccess = function() {
                  if (getRequest.result) {
                    console.log('[MicrobeTrace] Verification SUCCESS - data exists');
                  } else {
                    console.error('[MicrobeTrace] Verification FAILED - data not found!');
                  }
                };

                verifyTx.oncomplete = function() {
                  db.close();
                  resolve();
                };
              };

              transaction.onerror = function (event) {
                console.error('[MicrobeTrace] IndexedDB transaction error:', event.target.error);
                db.close();
                reject(new Error('Transaction failed: ' + event.target.error));
              };
            } catch (e) {
              console.error('[MicrobeTrace] IndexedDB operation error:', e);
              db.close();
              reject(e);
            }
          };
        }
      });
    },

    /**
     * _cleanupOldHandoffs - Remove old handoff data from IndexedDB
     *
     * Cleans up expired handoffs (those older than 15 minutes)
     */
    _cleanupOldHandoffs: function () {
      var now = Date.now();

      var request = indexedDB.open('localforage');
      request.onsuccess = function (event) {
        var db = event.target.result;

        try {
          var transaction = db.transaction(['keyvaluepairs'], 'readwrite');
          var store = transaction.objectStore('keyvaluepairs');

          // Get all keys
          var keysRequest = store.getAllKeys();
          keysRequest.onsuccess = function () {
            var keys = keysRequest.result || [];
            var handoffKeys = keys.filter(function (key) {
              return typeof key === 'string' && key.startsWith('handoff:');
            });

            // Check each handoff key for expiration
            handoffKeys.forEach(function (key) {
              var getRequest = store.get(key);
              getRequest.onsuccess = function () {
                var data = getRequest.result;
                if (data && data.expiresAt && data.expiresAt < now) {
                  store.delete(key);
                  console.log('[MicrobeTrace] Cleaned up expired handoff:', key);
                }
              };
            });
          };

          transaction.oncomplete = function () {
            db.close();
          };
        } catch (e) {
          console.warn('[MicrobeTrace] Could not clean up old handoffs:', e);
          db.close();
        }
      };

      request.onerror = function () {
        console.warn('[MicrobeTrace] Could not open IndexedDB for cleanup');
      };
    },

    /**
     * _inferFileKind - Determine the MicrobeTrace file kind from extension and content
     */
    _inferFileKind: function (ext, content, filename) {
      // Check extension first
      if (['fasta', 'fa', 'fna', 'faa', 'fas'].indexOf(ext) >= 0) {
        return 'fasta';
      }
      if (['nwk', 'newick', 'tree', 'tre'].indexOf(ext) >= 0) {
        return 'newick';
      }

      // Check content patterns
      var trimmed = content.trim();

      // FASTA starts with >
      if (trimmed.charAt(0) === '>') {
        return 'fasta';
      }

      // Newick starts with ( and ends with ;
      if (trimmed.charAt(0) === '(' && trimmed.charAt(trimmed.length - 1) === ';') {
        return 'newick';
      }

      // JSON check for Auspice
      if (trimmed.charAt(0) === '{') {
        try {
          var parsed = JSON.parse(trimmed);
          if (parsed.meta && parsed.tree) {
            return 'auspice';
          }
        } catch (e) {
          // Not valid JSON
        }
      }

      // Check filename hints for node/link/matrix
      var lowerName = filename.toLowerCase();
      if (/matrix|distance|dist/.test(lowerName)) {
        return 'matrix';
      }
      if (/link|edge|network|pair/.test(lowerName)) {
        return 'link';
      }
      if (/node|metadata|attribute|sample|case/.test(lowerName)) {
        return 'node';
      }

      // Default to node for tabular data
      if (ext === 'csv' || ext === 'tsv') {
        return 'node';
      }

      // Let MicrobeTrace auto-detect
      return 'auto';
    },

    /**
     * _getFileTypeLabel - Get human-readable label for file type
     */
    _getFileTypeLabel: function (kind) {
      var labels = {
        'fasta': 'FASTA Sequences',
        'newick': 'Newick Tree',
        'csv': 'CSV Data',
        'tsv': 'TSV Data',
        'node': 'Node Metadata',
        'link': 'Link/Edge Data',
        'matrix': 'Distance Matrix',
        'auspice': 'Auspice JSON',
        'auto': 'Data File'
      };
      return labels[kind] || 'Data File';
    },

    /**
     * _formatFileSize - Format file size in human-readable format
     */
    _formatFileSize: function (bytes) {
      if (bytes < 1024) return bytes + ' bytes';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    /**
     * _showLoading - Display loading indicator
     */
    _showLoading: function () {
      domConstruct.empty(this.contentPane.domNode);
      var loadingDiv = domConstruct.create('div', {
        style: 'display: flex; justify-content: center; align-items: center; height: 100%; flex-direction: column;'
      });
      domConstruct.create('i', {
        className: 'fa icon-spinner fa-spin fa-3x',
        style: 'color: #17a2b8; margin-bottom: 15px;'
      }, loadingDiv);
      domConstruct.create('span', {
        innerHTML: 'Loading file information...',
        style: 'color: #6c757d; font-size: 14px;'
      }, loadingDiv);
      domConstruct.place(loadingDiv, this.contentPane.domNode);
    },

    /**
     * _showError - Display error message
     */
    _showError: function (message) {
      domConstruct.empty(this.contentPane.domNode);
      var errorDiv = domConstruct.create('div', {
        style: 'display: flex; justify-content: center; align-items: center; height: 100%; flex-direction: column;'
      });
      domConstruct.create('i', {
        className: 'fa icon-warning fa-3x',
        style: 'color: #dc3545; margin-bottom: 15px;'
      }, errorDiv);
      domConstruct.create('span', {
        innerHTML: this._escapeHtml(message),
        style: 'color: #dc3545; font-size: 14px;'
      }, errorDiv);
      domConstruct.place(errorDiv, this.contentPane.domNode);
    },

    /**
     * _getFileExtension - Extract file extension from filename
     */
    _getFileExtension: function (filename) {
      var parts = filename.split('.');
      if (parts.length < 2) return '';
      return parts.pop().toLowerCase();
    },

    /**
     * _getIconForFileType - Return appropriate icon class for file type
     */
    _getIconForFileType: function (fileType) {
      switch (fileType) {
        case 'fasta':
        case 'fa':
        case 'fna':
        case 'faa':
          return 'fa icon-fasta';
        case 'csv':
        case 'tsv':
          return 'fa icon-table';
        case 'nwk':
        case 'newick':
          return 'fa icon-tree';
        case 'json':
        case 'microbetrace':
          return 'fa icon-network';
        default:
          return 'fa icon-file-text-o';
      }
    },

    /**
     * _escapeHtml - Escape HTML to prevent XSS
     */
    _escapeHtml: function (str) {
      if (typeof str !== 'string') return str;
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    /**
     * destroy - Clean up resources
     */
    destroy: function () {
      // Clear stored file content to free memory
      this._fileContent = null;
      this.inherited(arguments);
    }
  });
});
