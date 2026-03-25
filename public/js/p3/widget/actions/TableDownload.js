define(
  ['dijit/popup', 'dijit/TooltipDialog', 'dojo/on', 'dojo/dom-construct'],

  function (popup, TooltipDialog, on, domConstruct) {

    return function (options) {

      options = options || {};

      var dfc = '<div>Download Table As...</div><div class="wsActionTooltip" rel="text/tsv">Text</div><div class="wsActionTooltip" rel="text/csv">CSV</div><div class="wsActionTooltip" rel="application/vnd.openxmlformats">Excel</div>';

      var downloadTT = new TooltipDialog({
        content: dfc,
        onMouseLeave: function () {
          popup.close(downloadTT);
        }
      });

      return [
        'DownloadTable',
        'fa icon-download fa-2x',
        {
          label: 'DOWNLOAD',
          multiple: false,
          validTypes: ['*'],
          tooltip: 'Download Table',
          tooltipDialog: downloadTT
        },
        function (selection) {
          console.log('CLICKED');
          on(downloadTT.domNode, 'div:click', function (evt) {
            console.log('DownloadTT: ', evt);
            var rel = evt.target.attributes.rel.value;
            var dataType = options.dataType;
            var currentQuery = options.getQuery();
            console.log('DownloadQuery: ', currentQuery);
            var query = currentQuery + '&sort(+' + options.primaryKey + ')&limit(' + options.limit + ')';

            var baseUrl = window.App.dataAPI + dataType + '/?http_accept=' + rel + '&http_download=true';

            var form = domConstruct.create('form', {
              style: 'display: none;',
              id: 'downloadForm',
              enctype: 'application/x-www-form-urlencoded',
              name: 'downloadForm',
              method: 'post',
              action: baseUrl
            }, document.body);
            domConstruct.create('input', {
              type: 'hidden',
              value: encodeURIComponent(query),
              name: 'rql'
            }, form);
            // Add authorization as form field for POST requests
            if (window.App.authorizationToken) {
              domConstruct.create('input', {
                type: 'hidden',
                value: window.App.authorizationToken,
                name: 'http_authorization'
              }, form);
            }
            form.submit();

            popup.close(downloadTT);
          });

          console.log('Popup Open', downloadTT);
          popup.open({
            popup: downloadTT,
            around: options.button,
            orient: ['below']
          });
        },
        true,
        'left'
      ];
    };

  }
);
