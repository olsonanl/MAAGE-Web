define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'dojo/topic',
  'dojo/request',
  'dojo/store/Memory',
  './SearchBase',
  'dojo/text!./templates/AMRPhenotypeSearch.html',
  './TextInputEncoder',
  './FacetStoreBuilder',
  './PathogenGroups',
  './HostGroups'
], function (
  declare,
  lang,
  Topic,
  xhr,
  Memory,
  SearchBase,
  template,
  TextInputEncoder,
  storeBuilder,
  pathogenGroupStore,
  hostGroupStore
) {

  function sanitizeInput(str) {
    return str.replace(/\(|\)|\.|\*|\||\[|\]/g, '')
  }

  return declare([SearchBase], {
    templateString: template,
    searchAppName: 'AMR Phenotype Search',
    pageTitle: 'AMR Phenotype Search | BV-BRC',
    dataKey: 'genome_amr',
    resultUrlBase: '/view/GenomeList/?',
    resultUrlHash: '#view_tab=amr',
    postCreate: function () {
      this.inherited(arguments)

      // genome metadata stores
      this.pathogenGroupNode.store = pathogenGroupStore
      this.hostGroupNode.store = hostGroupStore

      storeBuilder('genome', 'host_common_name').then(lang.hitch(this, (store) => {
        this.hostNameNode.store = store
      }))

      storeBuilder('genome', 'geographic_group').then(lang.hitch(this, (store) => {
        this.geographicGroupNode.store = store
      }))

      storeBuilder('genome', 'isolation_country').then(lang.hitch(this, (store) => {
        this.isolationCountryNode.store = store
      }))

      storeBuilder('genome', 'state_province').then(lang.hitch(this, (store) => {
        this.stateProvinceNode.store = store
      }))

      storeBuilder('genome', 'subtype').then(lang.hitch(this, (store) => {
        this.subtypeNode.store = store
      }))

      storeBuilder('genome', 'segment').then(lang.hitch(this, (store) => {
        this.segmentNode.store = store
      }))

      storeBuilder('genome', 'season').then(lang.hitch(this, (store) => {
        this.seasonNode.store = store
      }))

      storeBuilder('genome', 'lineage').then(lang.hitch(this, (store) => {
        this.lineageNode.store = store
      }))

      // AMR-specific stores - use Solr facet queries since /data/distinct/ may not support genome_amr
      this._buildAMRFacetStore('antibiotic').then(lang.hitch(this, (store) => {
        this.antibioticNode.store = store
      }))

      this._buildAMRFacetStore('resistant_phenotype').then(lang.hitch(this, (store) => {
        this.resistantPhenotypeNode.store = store
      }))

      this._buildAMRFacetStore('evidence').then(lang.hitch(this, (store) => {
        this.evidenceNode.store = store
      }))
    },
    _buildAMRFacetStore: function (field) {
      var baseUrl = window.App.dataAPI || window.App.dataServiceURL || ''
      if (baseUrl.charAt(baseUrl.length - 1) !== '/') {
        baseUrl += '/'
      }
      var url = baseUrl + 'genome_amr/'
      var query = 'eq(id,*)&limit(1)&facet((field,' + field + '),(mincount,1),(limit,-1))&json(nl,map)'

      return xhr.post(url, {
        handleAs: 'json',
        headers: {
          'accept': 'application/solr+json',
          'content-type': 'application/rqlquery+x-www-form-urlencoded',
          'X-Requested-With': null,
          'Authorization': (window.App.authorizationToken || '')
        },
        data: query
      }).then(function (res) {
        var values = []
        if (res && res.facet_counts && res.facet_counts.facet_fields && res.facet_counts.facet_fields[field]) {
          var facetData = res.facet_counts.facet_fields[field]
          values = Object.keys(facetData).map(function (val) {
            return { name: val, id: val }
          })
          values.sort(function (a, b) {
            return a.name.localeCompare(b.name)
          })
        }
        return new Memory({ data: values })
      }, function (err) {
        console.error('Failed to fetch AMR facet data for ' + field, err)
        return new Memory({ data: [] })
      })
    },
    onPathogenGroupChange: function () {
      if (this.pathogenGroupNode.get('value') === '11320') {
        this.influenzaCriteriaNode.style.display = 'block'
        this.sarsCoV2CriteriaNode.style.display = 'none'
      }
      else if (this.pathogenGroupNode.get('value') === '2697049') {
        this.influenzaCriteriaNode.style.display = 'none'
        this.sarsCoV2CriteriaNode.style.display = 'block'
      }
      else {
        this.influenzaCriteriaNode.style.display = 'none'
        this.sarsCoV2CriteriaNode.style.display = 'none'
      }
    },
    onGenomeCompleteChecked: function () {
      if (this.genomeCompleteNode.checked) {
        this.genomeLengthFromNode.setAttribute('disabled', true)
        this.genomeLengthToNode.setAttribute('disabled', true)
      }
      else {
        this.genomeLengthFromNode.setAttribute('disabled', false)
        this.genomeLengthToNode.setAttribute('disabled', false)
      }
    },
    _buildGenomeQuery: function () {
      let genomeQueryArr = []

      const keywordValue = this.keywordNode.get('value')
      if (keywordValue !== '') {
        genomeQueryArr.push(`keyword(${TextInputEncoder(sanitizeInput(keywordValue))})`)
      }

      const pathogenGroupValue = this.pathogenGroupNode.get('value')
      if (pathogenGroupValue !== '') {
        genomeQueryArr.push(`eq(taxon_lineage_ids,${sanitizeInput(pathogenGroupValue)})`)
      }

      const taxonNameValue = this.taxonNameNode.get('value')
      if (taxonNameValue !== '') {
        genomeQueryArr.push(`eq(taxon_lineage_ids,${sanitizeInput(taxonNameValue)})`)
      }

      const genomeIDValue = this.genomeIDNode.get('value')
      if (genomeIDValue !== '') {
        genomeQueryArr.push(`eq(genome_id,${TextInputEncoder(genomeIDValue)})`)
      }

      const genomeNameValue = this.genomeNameNode.get('value')
      if (genomeNameValue !== '') {
        genomeQueryArr.push(`eq(genome_name,${TextInputEncoder(sanitizeInput(genomeNameValue))})`)
      }

      const hostGroupValue = this.hostGroupNode.get('value')
      if (hostGroupValue !== '') {
        genomeQueryArr.push(`eq(host_group,${sanitizeInput(hostGroupValue)})`)
      }

      const hostNameValue = this.hostNameNode.get('value')
      if (hostNameValue !== '') {
        genomeQueryArr.push(`eq(host_common_name,${sanitizeInput(hostNameValue)})`)
      }

      const geographicGroupValue = this.geographicGroupNode.get('value')
      if (geographicGroupValue !== '') {
        genomeQueryArr.push(`eq(geographic_group,${geographicGroupValue})`)
      }

      const isolationCountryValue = this.isolationCountryNode.get('value')
      if (isolationCountryValue !== '') {
        genomeQueryArr.push(`eq(isolation_country,${sanitizeInput(isolationCountryValue)})`)
      }

      const stateProvinceValue = this.stateProvinceNode.get('value')
      if (stateProvinceValue !== '') {
        genomeQueryArr.push(`eq(state_province,${sanitizeInput(stateProvinceValue)})`)
      }

      const collectionYearFromValue = parseInt(this.collectionYearFromNode.get('value'))
      const collectionYearToValue = parseInt(this.collectionYearToNode.get('value'))
      if (!isNaN(collectionYearFromValue) && !isNaN(collectionYearToValue)) {
        genomeQueryArr.push(`between(collection_year,${collectionYearFromValue},${collectionYearToValue})`)
      } else if (!isNaN(collectionYearFromValue)) {
        genomeQueryArr.push(`gt(collection_year,${collectionYearFromValue})`)
      } else if (!isNaN(collectionYearToValue)) {
        genomeQueryArr.push(`lt(collection_year,${collectionYearToValue})`)
      }

      const genomeLengthFromValue = parseInt(this.genomeLengthFromNode.get('value'))
      const genomeLengthToValue = parseInt(this.genomeLengthToNode.get('value'))
      if (!isNaN(genomeLengthFromValue) && !isNaN(genomeLengthToValue)) {
        genomeQueryArr.push(`between(genome_length,${genomeLengthFromValue},${genomeLengthToValue})`)
      } else if (!isNaN(genomeLengthFromValue)) {
        genomeQueryArr.push(`gt(genome_length,${genomeLengthFromValue})`)
      } else if (!isNaN(genomeLengthToValue)) {
        genomeQueryArr.push(`lt(genome_length,${genomeLengthToValue})`)
      }

      const genomeCompleteCheckbox = this.genomeCompleteNode.get('value')
      if (genomeCompleteCheckbox) {
        genomeQueryArr.push(`eq(genome_status,${'Complete'})`)
      }

      const subtypeValue = this.subtypeNode.get('value')
      if (subtypeValue !== '') {
        genomeQueryArr.push(`eq(subtype,${sanitizeInput(subtypeValue)})`)
      }

      const segmentValue = this.segmentNode.get('value')
      if (segmentValue !== '') {
        genomeQueryArr.push(`eq(segment,${sanitizeInput(segmentValue)})`)
      }

      const seasonValue = this.seasonNode.get('value')
      if (seasonValue !== '') {
        genomeQueryArr.push(`eq(season,${sanitizeInput(seasonValue)})`)
      }

      const lineageValue = this.lineageNode.get('value')
      if (lineageValue !== '') {
        genomeQueryArr.push(`eq(lineage,${lineageValue})`)
      }

      if (genomeQueryArr.length > 0) {
        return `eq(genome_id,*)&genome(${genomeQueryArr.join(',')})`
      }
      return 'eq(genome_id,*)'
    },
    _buildAMRFilter: function () {
      let amrFilterArr = []

      const antibioticValue = this.antibioticNode.get('value')
      if (antibioticValue !== '') {
        amrFilterArr.push(`eq(antibiotic,${TextInputEncoder(sanitizeInput(antibioticValue))})`)
      }

      const resistantPhenotypeValue = this.resistantPhenotypeNode.get('value')
      if (resistantPhenotypeValue !== '') {
        amrFilterArr.push(`eq(resistant_phenotype,${TextInputEncoder(sanitizeInput(resistantPhenotypeValue))})`)
      }

      const evidenceValue = this.evidenceNode.get('value')
      if (evidenceValue !== '') {
        amrFilterArr.push(`eq(evidence,${TextInputEncoder(sanitizeInput(evidenceValue))})`)
      }

      const advancedQueryArr = this._buildAdvancedQuery()
      if (advancedQueryArr.length > 0) {
        amrFilterArr = amrFilterArr.concat(advancedQueryArr)
      }

      if (amrFilterArr.length > 1) {
        return 'and(' + amrFilterArr.join(',') + ')'
      } else if (amrFilterArr.length === 1) {
        return amrFilterArr[0]
      }
      return ''
    },
    buildQuery: function () {
      return this._buildGenomeQuery()
    },
    onSubmit: function (evt) {
      evt.preventDefault()
      evt.stopPropagation()

      const query = this._buildGenomeQuery()
      const amrFilter = this._buildAMRFilter()

      let url = this.resultUrlBase + query + this.resultUrlHash
      if (amrFilter) {
        url += '&filter=' + amrFilter
      }
      // debugger;
      Topic.publish('/navigate', { href: url })
    }
  })
})
