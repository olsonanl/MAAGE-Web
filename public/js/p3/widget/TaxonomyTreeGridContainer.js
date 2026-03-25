define([
  'dojo/_base/declare', './GridContainer', 'dojo/dom-construct',
  './TaxonomyTreeGrid', 'dijit/popup',
  'dijit/TooltipDialog', './FacetFilterPanel',
  'dojo/_base/lang', 'dojo/on'
], function (
  declare, GridContainer, domConstruct,
  Grid, popup,
  TooltipDialog, FacetFilterPanel,
  lang, on
) {

  var vfc = '<div class="wsActionTooltip" rel="dna">View FASTA DNA</div><divi class="wsActionTooltip" rel="protein">View FASTA Proteins</div>';
  var viewFASTATT = new TooltipDialog({
    content: vfc,
    onMouseLeave: function () {
      popup.close(viewFASTATT);
    }
  });

  var dfc = '<div>Download Table As...</div><div class="wsActionTooltip" rel="text/tsv">Text</div><div class="wsActionTooltip" rel="text/csv">CSV</div><div class="wsActionTooltip" rel="application/vnd.openxmlformats">Excel</div>';
  var downloadTT = new TooltipDialog({
    content: dfc,
    onMouseLeave: function () {
      popup.close(downloadTT);
    }
  });

  on(downloadTT.domNode, 'div:click', function (evt) {
    var rel = evt.target.attributes.rel.value;
    // console.log("REL: ", rel);
    // var selection = self.actionPanel.get('selection');
    var dataType = (self.actionPanel.currentContainerWidget.containerType == 'genome_group') ? 'genome' : 'genome_feature';
    var currentQuery = self.actionPanel.currentContainerWidget.get('query');
    // console.log("selection: ", selection);
    // console.log("DownloadQuery: ", dataType, currentQuery );

    var baseUrl = '/api/' + dataType + '/?http_accept=' + rel + '&http_download=true';

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
      value: encodeURIComponent(currentQuery),
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

  return declare([GridContainer], {
    'class': 'GridContainer TaxonTreeGrid',
    facetFields: [],
    enableFilterPanel: false,
    dataModel: 'taxonomy',
    containerType: 'taxonomy_data',
    tutorialLink: 'quick_references/organisms_taxon/taxonomy.html',
    tooltip: 'The "Taxonomy" tab provides taxonomy subtree for the current taxon level.',
    onSetState: function (attr, oldState, state) {
      // console.log("GridContainer onSetState: ", state, " oldState:", oldState);
      if (!state) {
        // console.log("!state in grid container; return;")
        return;
      }

      if (state && state.search) {
        this.set('query', state.search);
      }
    },
    getFilterPanel: function (opts) {
    },
    containerActions: GridContainer.prototype.containerActions.concat([
      [
        'ToggleFilters',
        'fa icon-filter fa-2x',
        {
          label: 'FILTERS',
          multiple: false,
          validTypes: ['*'],
          tooltip: 'Toggle Filters',
          tooltipDialog: downloadTT
        },
        function (selection) {
          on.emit(this.domNode, 'ToggleFilters', {});
        },
        true
      ],
      [
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
          popup.open({
            popup: this.containerActionBar._actions.DownloadTable.options.tooltipDialog,
            around: this.containerActionBar._actions.DownloadTable.button,
            orient: ['below']
          });
        },
        true
      ]
    ]),
    gridCtor: Grid

  });
});
