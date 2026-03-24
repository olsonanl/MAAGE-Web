define([
  'dojo/_base/declare', 'dijit/_WidgetBase', 'dojo/on', 'dojo/dom-construct',
  'dojo/dom-class', 'dijit/_TemplatedMixin', 'dijit/_WidgetsInTemplateMixin',
  'dojo/text!./MAAGEGlobalSearch.html', 'dijit/registry', 'dojo/_base/lang',
  'dojo/dom', 'dojo/topic', 'dojo/keys', 'dijit/_FocusMixin', 'dijit/focus',
  '../../util/searchToQuery', '../../util/searchToQueryWithOr',
  '../../util/searchToQueryWithQuoteOr', '../../util/searchToQueryWithQuoteAnd',
  'p3/widget/maage/MAAGETextBox', 'p3/widget/maage/MAAGESelect'
], function (
  declare, WidgetBase, on, domConstruct,
  domClass, Templated, WidgetsInTemplate,
  template, Registry, lang,
  dom, Topic, keys, FocusMixin, focusUtil,
  searchToQuery, searchToQueryWithOr,
  searchToQueryWithQuoteOr, searchToQueryWithQuoteAnd,
  MAAGETextBox, MAAGESelect
) {

  function processQuery(query, searchOption) {
    query = query.replace(/'/g, '').replace(/:/g, ' ')
                 .replace(/\(\+\)|\(-\)|,|\+|-|=|<|>|\\|\//g, ' ');

    if (query.charAt(0) === '"' && query.match(/[\(\)\[\]\{\}]/)) {
      query = query.replace(/"/g, '');
    }

    if (query.charAt(0) !== '"' || query.match(/[\(\)\[\]\{\}]/)) {
      const keywords = query.split(/\s|[\(\)\[\]\{\}]/).map((k) => {
        if (!k) return '';
        if (!k.startsWith('"') && !k.endsWith('"') &&
            (k.match(/^fig\|[0-9]+/) || k.match(/[0-9]+\.[0-9]+/) || k.match(/[0-9]+$/))) {
          return `"${k}"`;
        }
        return k;
      });
      query = keywords.join(' ');
    }

    switch (searchOption) {
      case 'option_or': return searchToQueryWithOr(query);
      case 'option_or2': return searchToQueryWithQuoteOr(query);
      case 'option_and2': return searchToQueryWithQuoteAnd(query);
      default: return searchToQuery(query);
    }
  }

  return declare([WidgetBase, Templated, WidgetsInTemplate, FocusMixin], {
    templateString: template,
    baseClass: 'MAAGEGlobalSearch',
    disabled: false,
    value: '',

    _setValueAttr: function (q) {
      this.query = q;
      this.searchInput.set('value', q);
    },

    onKeypress: function (evt) {
      const key = evt.charOrCode || evt.keyCode;
      if (key === 13) {
        if (evt.preventDefault) { evt.preventDefault(); }
        this._doSearch();
      }
    },

    onClickAdvanced: function () {
      this._doSearch();
    },

    onInputChange: function (val) {
      // Optional: hook up debounce or live search preview
    },

    _doSearch: function () {
      const query = this.searchInput.get('value').trim();
      const searchFilter = this.searchFilter.get('value');
      const searchOption = this.searchOption.get('value');

      if (!query || !query.match(/[a-z0-9]/i)) return;

      const q = processQuery(query, searchOption);
      let path = null;

      switch (searchFilter) {
        case 'everything': path = '/search/?' + q; break;
        case 'sp_genes': path = '/view/SpecialtyGeneList/?' + q; break;
        case 'genome_features': path = '/view/FeatureList/?' + q + '#view_tab=features&defaultSort=-score'; break;
        case 'proteins': path = '/view/ProteinList/?' + q + '#view_tab=proteins&defaultSort=-score'; break;
        case 'genomes': path = '/view/GenomeList/?' + q + '#view_tab=genomes&defaultSort=-score'; break;
        case 'protein_features': path = '/view/ProteinFeaturesList/?' + q; break;
        case 'protein_structures': path = '/view/ProteinStructureList/?' + q; break;
        case 'pathways': path = '/view/PathwayList/?' + q; break;
        case 'subsystems': path = '/view/SubsystemList/?' + q; break;
        case 'taxonomy': path = '/view/TaxonList/?' + q; break;
        default: path = '/search/?' + q; break;
      }

      Topic.publish('/navigate', { href: path });

      on.emit(this.domNode, 'dialogAction', { action: 'close', bubbles: true });

      if (window.gtag) {
        gtag('event', 'GlobalSearch', {
          query: encodeURIComponent(query),
          category: searchFilter
        });
      }
    }
  });
});