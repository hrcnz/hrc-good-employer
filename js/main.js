
//$(function() {

  // globals   
  //
  // the pseudo database: all data kept in google spreadsheet   
  var doc_key  = '0AswFq_8FWOlndERBTzlFT1lCY04zWG9UcEQ1VE92eFE',
      doc_url  = 'https://docs.google.com/spreadsheet/pub?hl=en_US&hl=en_US&key='+doc_key+'&output=html',
      models   = {},
      views    = {},
      routers  = {},
      app      = {},
      plot;  
  
  /*
   * backbone models & collections
   */
  models.Filter = Backbone.Model.extend({});
  // YEARS
  //
  // Model:
  // Year-specific data for all entities, based on sheet 'Year' of the google spreadsheet 
  // each year row references a year-specific sheet that holds all year- and entity specifc information
  models.Year = Backbone.Model.extend({
    // check if the year is active 
    isActive: function(){
      return (this.get('active')) === 'TRUE' ? true : false;              
    }    
  });
  // Collection of year models
  models.Years = Backbone.Collection.extend({        
    model: models.Year,
    initialize: function() {
      this.sort_key = 'year';
    },            
    //filter models by year
    byYear : function(year){
      var filtered = this.filter(function(year_model) {
        return year_model.get("year") === year;
      });
      return new models.Years(filtered);            
    },
    // allow sorting by score and alphabetically       
    comparator: function(a, b) {      
        a = a.get(this.sort_key);
        b = b.get(this.sort_key);
        return a < b ?  1
             : a > b ? -1
             :          0;      
    },  
    getLast : function(){
      this.active().sort();
      return this.first().get("year");
    },
    getFirst : function(){
      this.active().sort();
      return this.last().get("year");
    },
    // only active
    active : function(){
      var filtered = this.filter(function(year) {
        return year.isActive();
      });
      return new models.Years(filtered);
    },            
  });
  
  // TYPES CATEGORISATION
  //   
  // Defines type categories, based on sheet 'Types' of the google spreadsheet 
  models.Type = Backbone.Model.extend({});  
  models.Types = Backbone.Collection.extend({        
    model: models.Type
  });
  
  // SIZES CATEGORISATION
  // 
  // Defines staff size categories, based on sheet 'Sizes' of the google spreadsheet 
  models.Size = Backbone.Model.extend({});
  models.Sizes = Backbone.Collection.extend({        
    model: models.Size,
    bySize : function (staffno) {
      var filtered = this.filter(function(size) { 
        if (staffno !== '' && staffno > 0) {
          return (Math.ceil(staffno) >= size.get('min') && Math.ceil(staffno) <= size.get('max') );                     
        } 
      }); 
      return new models.Sizes(filtered);
    },
  });
  
  // CRITERIA
  // 
  // Defines entity criteria, based on sheet 'Criteria' of the google spreadsheet 
  // Criterion ID field references column name of 'records'
  models.Criterion = Backbone.Model.extend({
    initialize: function(){
      this.id = this.get('id').replace('_','');
    },
  });
  models.Criteria = Backbone.Collection.extend({        
    model: models.Criterion,
    // the total points achievable
    // currently 1 point for each criterion
    getMax : function(){
      return this.length;
    }
  });
  
  // CRITERIAGROUPS
  // 
  // Defines groups of entity criteria, based on sheet 'CriteriaGroups' of the google spreadsheet 
  // ID referenced by field criteriongroupid of criteria 
  models.CriteriaGroup = Backbone.Model.extend({
    //initialise
    initialize: function(){
      this.count_criteria();
    },
    //count criteria that belong to group
    count_criteria: function() {
      var group_count = 0;
      var model = this;
      app.Criteria.each(function(criterion){
        if (criterion.get('criteriongroupid') === model.get('id')){          
          group_count++;
        }        
      });
      this.count = group_count;
    },
  });
  models.CriteriaGroups = Backbone.Collection.extend({        
    model: models.CriteriaGroup
  }); 
  
  // RECORDS
  //
  // The scores for each year and entity, based on the year specific sheets of the google spreadsheet (one for each year)
  // Field entity ID connects entities' scores over multiple years
  models.Record = Backbone.Model.extend({
    initialize: function(){
      
    },
    // check if the record is active, always returns active
    isActive: function(isActive){
      isActive = typeof isActive !== "undefined" ? isActive : true;
      return (this.get('active')) === 'TRUE' ? true : !isActive;              
    },        
    // calculate total score, return as points or percentage
    getTotal : function(isPercentage){
      isPercentage = typeof isPercentage !== "undefined" ? isPercentage : false;
      var total = 0;
      var model = this;
      //count points for each criterion
      app.Criteria.each(function(criterion){
        total += model.getCriterionScore(criterion.id);
      });
      if (isPercentage){
        return Math.round((total/app.Criteria.getMax()) * 100);      
      } else {
        return total;
      }
    },
    // get score of specific criterion, usually 0 or 1
    getCriterionScore : function(criterion_id){      
      return ($.isNumeric(this.get(criterion_id))) ? this.get(criterion_id) : 0;
    },
    // calculate score for a criteria group, return as points or percentage
    getGroupScore : function(groupid, isPercentage){
      isPercentage = typeof isPercentage !== "undefined" ? isPercentage : false;
      
      var total = 0;
      var count = 0;
      var model = this;
      //count points and number of criteria for group
      app.Criteria.each(function(criterion){
        if (criterion.get('criteriongroupid') === groupid){
          total += model.getCriterionScore(criterion.id);
          count++; // maybe better reference group count
        }
      });      
      if (isPercentage){
        return Math.round((total/count) * 100);      
      } else {
        return total;
      }
    },
    // get rank of an entity 
    getRank : function(){
      // rank is the number of entities with a greater score plus 1
      // eg no one better >>> rank 1
      // eg 10 entities with better score >>> rank 11
      return app.Records.byScore(this.get('year'),this.getTotal()).length + 1;
    },   
    getTotalChange : function(year, isPercentage){
      isPercentage = typeof isPercentage !== "undefined" ? isPercentage : false;
      // defaults to previous year
      year = typeof year !== "undefined" ? year : this.get('year')-1;
      //get record for specified year and same entity id
      // get total of year to compare
      var preRecord = app.Records.byEntity(this.get('entityid')).byYear(year).models[0];
      if (typeof preRecord !== "undefined"){
         return this.getTotal(isPercentage) - preRecord.getTotal(isPercentage);
      } else {
        return false;
      }
    },
    getRankChange : function(year){
      // defaults to previous year
      year = typeof year !== "undefined" ? year : this.get('year')-1;
      //get record for specified year and same entity id
      // get total of year to compare
      var preRecord = app.Records.byEntity(this.get('entityid')).byYear(year).models[0];
      if (typeof preRecord !== "undefined"){
         return this.getRank() - preRecord.getRank();
      } else {
        return false;
      }
    },  
    getStaffNo : function(){     
      return (this.get('staffno') !== '') ? this.get('staffno') : 'Not specified';
    },
    getTypeTitle : function(){
      return (this.get('typeid') !== '') ? app.Types.findWhere({id : this.get('typeid').trim()}).get('title') : 'Not specified';      
    },
    
  });
  // the record collection - holds all records for all entities and years
  models.Records = Backbone.Collection.extend({        
    model: models.Record,
    //
    initialize: function() {
      this.sort_key = 'title';
    },
    // allow sorting by score and alphabetically       
    comparator: function(a, b) {
      if (this.sort_key === 'score'){
        a = a.getTotal();
        b = b.getTotal();
        return a > b ?  1
             : a < b ? -1
             :          0;
      } else {
        a = a.get(this.sort_key).toLowerCase();
        b = b.get(this.sort_key).toLowerCase();
        return a > b ?  1
             : a < b ? -1
             :          0;
      }
    },
    // get sorted collection 
    sortBy: function(key){
      this.sort_key = key;
      return this.sort();
    },
    // only active
    active : function(){
      var filtered = this.filter(function(record) {
        return record.isActive();
      });
      return new models.Records(filtered);
    },
    // filter by year        
    byYear : function(year, isActive){
      isActive = typeof isActive !== "undefined" ? isActive : true;
      
      var filtered = this.filter(function(record) {
        return record.isActive(isActive) && record.get("year") === year;
      });
      return new models.Records(filtered);            
    },
    // filter by entity
    byEntity : function(entity_id, isActive){
      isActive = typeof isActive !== "undefined" ? isActive : true;      
      
      var filtered = this.filter(function(record) {
        return record.isActive(isActive) && record.get("entityid") === entity_id;
      });
      return new models.Records(filtered);         
    },
    //filter by type category
    byType : function(type, isActive){
      isActive = typeof isActive !== "undefined" ? isActive : true;
            
      var filtered = this.filter(function(record) { 
        if (type !== '') {
          return record.isActive(isActive) 
              && record.get('typeid') === type;
        } else {
          return record.isActive(isActive) 
              && record.get('typeid') === '';
        }
      });
      return new models.Records(filtered);
    },
    //filter by similar size category
    bySize : function(staffno, isActive){
      isActive = typeof isActive !== "undefined" ? isActive : true;
      
      var filtered = this.filter(function(record) { 
        if (staffno !== '' && staffno > 0) {
          var sizemin = 0;
          var sizemax = 0;
          app.Sizes.each(function(size){
            if (Math.ceil(staffno) >= size.get('min') && Math.ceil(staffno) <= size.get('max') ){
              sizemin = size.get('min');
              sizemax = size.get('max');            
            }
          });
          return record.isActive(isActive) 
              && Math.ceil(record.get('staffno')) >= sizemin 
              && Math.ceil(record.get('staffno')) <= sizemax;            
        } else {
          return record.isActive(isActive) 
              && (record.get('staffno') === '' || record.get('staffno') === 0) ;
        }
      }); 
      return new models.Records(filtered);
    },
    // filter by score, minimum score or range (min/max)
    byScore : function (year,min,max,isActive){
      max = typeof max !== "undefined" ? max : 0;
      isActive = typeof isActive !== "undefined" ? isActive : true;      
      
      var filtered = this.filter(function(record) { 
        if (max !== 0){
          return record.isActive(isActive) && record.getTotal() > min && record.getTotal() <= max && record.get("year") === year;
        } else {
          return record.isActive(isActive) && record.getTotal() > min && record.get("year") === year;
        }
      });
      return new models.Records(filtered);            
    },    
    // calculate averages overall or by criterion and criteriongroup in percentage
    // returns averages for each year       
    getResults : function(options){
      var defaults = {criterion:'all',group:'all'};
      
      var filters = $.extend( {}, defaults, options );
      
      // the return object array, will hold averages for each year
      var results = {};
      
      // determine number of criteria
      var no_criteria;
      if (filters.criterion !== 'all' ){
        no_criteria = 1;   
      } else if (filters.group !== 'all' ){
        no_criteria = app.CriteriaGroups.where({'id':filters.group})[0].count;       
      } else { // all
        no_criteria = app.Criteria.length;
      }
      // for all records, update totals and count, also calculates percentage each step << this could be done more efficiently
      this.each(function(record){
        //only active records
        if (record.isActive()){
          var year = record.get('year');
          //if key (year) present add totals
          if (year in results) {      
            if (filters.criterion !== 'all' ){
              results[year].total += record.getCriterionScore(filters.criterion);
            } else if (filters.group !== 'all' ){
              results[year].total += record.getGroupScore(filters.group);
            } else {
              results[year].total += record.getTotal();
            }
            results[year].count++;
          // else need to add key first
          } else {
            results[year] = {};
            if (filters.criterion !== 'all' ){
              results[year].total = record.getCriterionScore(filters.criterion);
            } else if (filters.group !== 'all' ){
              results[year].total = record.getGroupScore(filters.group);
            } else {
              results[year].total = record.getTotal();
            }              
            results[year].count = 1;
          }            
          results[year].percentage = Math.round(((results[year].total/results[year].count)/no_criteria) * 100);          
        }
      });
      return results;      
    },
    
    
  });
  
 /*
  * views.Intro
 */ 
  views.Intro = Backbone.View.extend({
    initialize: function () {
        this.render();
    },
    render: function(){
      var variables = { 
        minYear: app.Years.getFirst(), 
        maxYear: app.Years.getLast() };
      this.$el.html(this.template(variables));
      return this;      
    },            
    renderPDF: function (doc){
      
    },
    template: _.template('\
<h1>Crown Entities and the Good Employer</h1>\
<h3>Annual Report Review <%= minYear %> to <%= maxYear %></h3>\
<p>The Human Rights Comission reviews and analyses the reporting of good employer obligations\
by Crown entities and publishes its findings in an annual report "Crown entities and the Good Employer". \
Its role is to provide Equal Employment Opportunities (EEO) guidance to Crown entities and monitor thier progress.\
</p>\
    ')
  });
  
 /*
  * views.Tools
 */ 
  views.Tools = Backbone.View.extend({
    initialize: function () {        
        this.render();        
        this.listenTo(this.model, 'change', this.render);
    },
    render: function(){
      var variables = {
        entities        : app.Records.byYear(parseInt(this.model.get('year'))).models,
        types           : app.Types.models,
        sizes           : app.Sizes.models,
        years           : app.Years.active().models,        
        allActive       : (this.model.get('report') === "entities" && this.model.get('id') === 'all') ? 'active' : '',
        entityActiveID  : (this.model.get('report') === "entity") ? this.model.get('id') : '',        
        typeActiveID    : (this.model.get('report') === "type") ? this.model.get('id') : '',
        sizeActiveMin   : (this.model.get('report') === "size") ? this.model.get('id') : -1,
        yearActive      : parseInt(this.model.get('year'))
      };
      this.$el.html(this.template(variables));
      return this;      
    },            
    events : {
      "click #all"      : "selectAll",
      "click #renderPDF": "renderPDF",
      "change #entity"  : "selectEntity", 
      "change #type"    : "selectType", 
      "change #size"    : "selectSize", 
      "change #year"    : "selectYear", 
    },
    selectAll: function( event ){
      event.preventDefault();
      app.App.navigate(this.model.get('year') + '/report/entities-all', {trigger: true});
    },        
    selectEntity: function( event ){
      event.preventDefault();
      app.App.navigate(this.model.get('year') + '/report/entity-' + this.$("#entity").val(), {trigger: true});
    },        
    selectType: function( event ){
      event.preventDefault();
      app.App.navigate(this.model.get('year') + '/report/type-' + this.$("#type").val(), {trigger: true});
    },        
    selectSize: function( event ){
      event.preventDefault();
      app.App.navigate(this.model.get('year') + '/report/size-' + this.$("#size").val(), {trigger: true});
    },
    selectYear: function( event ){
      event.preventDefault();
      app.App.navigate(this.$("#year").val() + '/report/' + this.model.get('report') + '-' + this.model.get('id') , {trigger: true});
    },
    renderPDF: function( event ){
        event.preventDefault();
        // Button clicked, you can access the element that was clicked with event.currentTarget
        alert( "RenderPDF" );
    },            
    template: _.template('\
<button id="all" class="<%= allActive %>">All entities</button>\
<select id="entity">\
  <option value="none">Entity</option>\
  <% _.forEach(entities, function (entity) {%>\
    <option value="<%= entity.get("entityid") %>" <% if (entity.get("entityid") === parseInt(entityActiveID)) { print ("selected") } %> >\
    <%= entity.get("title") %></option>\
  <%})%>\
</select>\
<select id="type">\
  <option value="none">Type</option>\
  <% _.forEach(types, function (type) {%>\
    <option value="<%= type.get("id") %>" <% if (type.get("id") === typeActiveID) { print ("selected") } %> >\
    <%= type.get("title") %></option>\
  <%})%>\
</select>\
<select id="size">\
  <option value="none">Size</option>\
  <% _.forEach(sizes, function (size) {%>\
    <option value="<%= size.get("min") %>" <% if (size.get("min") <= sizeActiveMin && size.get("max") >= sizeActiveMin) { print ("selected") } %> >\
    <%= size.get("title") %></option>\
  <%})%>\
</select>\
<select id="year">\
  <% _.forEach(years, function (year) {%>\
    <option value="<%= year.get("year") %>" <% if (parseInt(year.get("year")) === yearActive) { print ("selected") } %>>\
    <%= year.get("year") %></option>\
  <%})%>\
</select>\
<a href="#" id="renderPDF">Download report as pdf</a>\
    ')                
  });
 /* 
  * views.Overview
  */
  views.Overview = Backbone.View.extend({
    initialize: function () {
        this.fields = {};
        this.render();        
        this.listenTo(this.model, 'change', this.render);
    },
    render: function() {
      var variables = {};
      //var resultsAll = app.Records.getResults();
      var year = parseInt(this.model.get('year'));
      
      this.fields.year = year;
      this.fields.title = '';
      this.fields.subtitle = '';
      this.fields.type_label = '';
      this.fields.type = '';
      this.fields.size_label = '';
      this.fields.size = '';
//maybe best treated as details view      
//      this.fields.overall_title = '';
//      this.fields.overall = '';
//      this.fields.overall_change = '';
//      this.fields.rank_title = '';
//      this.fields.rank = '';
//      this.fields.rank_of = '';
//      this.fields.rank_change = '';
//      this.fields.summary = '';
//maybe best implemented as a subview?      
//      this.fields.overall_comparison_title = '';
//      this.fields.overall_comparison_all = '';
//      this.fields.overall_comparison_type = '';
//      this.fields.overall_comparison_size = '';
//      this.fields.overall_comparison = false;
//      this.fields.overall_comparison_all_on = false;
//      this.fields.overall_comparison_type_on = false;
//      this.fields.overall_comparison_size_on = false;
 
      // depeding on report 
      // all entities
      if (this.model.get('report') === "entities" && this.model.get('id') === 'all') {
        this.fields.title = 'All entities';
        this.fields.subtitle = 'This report shows the average compliance of all Crown entities';
      } 
      // individual entity
      else if (this.model.get('report') === "entity") {
        var entityID = parseInt(this.model.get('id'));
        var entity = app.Records.byEntity(entityID).byYear(year).first();
        this.fields.title = entity.get('title');
        this.fields.subtitle = entity.get('explanation');
        this.fields.type_label = 'Type';
        this.fields.type = entity.getTypeTitle();
        this.fields.size_label = 'Size';
        this.fields.size = entity.getStaffNo();        
      }
      // type category report
      else if (this.model.get('report') === "type") {       
        var typeID = this.model.get('id');
        var type = app.Types.findWhere({id:typeID});
        this.fields.title = type.get('title');
      }     
      // size category report
      else if (this.model.get('report') === "size") {       
        var size = app.Sizes.bySize(this.model.get('id')).first();
        this.fields.title = size.get('title');
      }     
      this.$el.html(this.template(this.fields));      
      return this;      
    },
    renderGraph: function() {
      
    },
    toPDF : function (doc){
      
    },
template: _.template('\
<h2><%= title %></h2>\
<h4><%= subtitle %></h4>\
<h2><%= year %></h2>\n\
<% if (type !== "") {%>\n\
<div><span class="label"><%= type_label %>: </span><%= type %></div>\n\
<% } %>\n\
<% if (size !== "") {%>\n\
<div><span class="label"><%= size_label %>: </span><%= size %></div>\n\
<% } %>\n\
<div class="legend"></div><div class="plot"></div>\n\
    '),            
//    attributes: { class: '' },
//
//    plotOptions: {
//      yaxis: {},
//      xaxis: {},
//      legend: { show: true },
//      grid: { 
//        hoverable: true, 
//        clickable: true, 
//        autoHighlight: true, 
//        backgroundColor: '#ffffff'
//      },
//      series: {
//           bars: { show: true, fill: 0.7, barWidth: 0.8, align: 'center' }
//      }
//    },
//
//    render: function() {
//
//      this.$el.html('<div class="legend"></div><div class="plot"></div>');
//
//      return this;
//    },
//
//    renderGraph: function() {
//
//      var options = _.clone(this.plotOptions);
//      var data= [];
//      for ( i=0;i<this.collection.length;i++ ) {
//          data.push([i, this.collection.models[i].getTotal() ]);
//      }        
//
//      var dataset = [{ label : 'Entity Totals', data : data }];
//
//      // Now, the chart can be drawn ...
//      plot = $.plot( this.$('.plot'), dataset, options );
//
//    }      

  });  
    
  /*  
  views.Details
  for each criteria 
    if criterion does not belong to any group:
      criteriaView.render
    else
      if !group rendered:
        CriteriaGroupView.render
  */
  views.Details = Backbone.View.extend({
    initialize: function (attrs) {
        this.options = attrs;
        //create subviews for each criteria or group (for criteria that are part of a group)
        //this.subViews = ...
        this.render();        
        this.listenTo(this.model, 'change', this.render);
    },
    render: function() {
      
    },
//    renderGraphs: function() { 
//    },
    close: function() {
      _.each(this.subViews, function(view) { view.remove(); });
      this.remove();
    },
    toPDF : function (doc){
      
    }            
  }); 
  
  views.Criterion = Backbone.View.extend({
    initialize: function (attrs) {
        this.options = attrs;
        this.render();
    },
    render: function() {
      
    },
    renderGraph: function() {
      
    },
    toPDF : function (doc){
      
    }    
  });
  views.CriteriaGroup = Backbone.View.extend({
    initialize: function (attrs) {
        this.options = attrs;
        this.render();
    },
    render: function() {
      
    },
    renderGraph: function() {
      
    },
    toPDF : function (doc){
      
    }    
  });
  
  // Routers
  routers.App = Backbone.Router.extend({
    routes: {
        '': 'redirect',
        'report/*filter': 'redirect',
        ':year': 'year',
        ':year/report/*filter': 'report' //fully qualified
    },            
    // year missing > add most recent year
    redirect: function(route) {
        console.log('route:redirect');
        
        var year = app.Years.getLast(); 
        
        if (route) {          
          this.navigate(year.toString() + '/report/' + route, {trigger: true});
        } else {
          this.navigate(year.toString(), {trigger: true});
        }
    },
    // year specified, report missing >>> add report
    year: function(year) {
        console.log('route:year');
        
        //may need to validate further
        if ($.isNumeric(year)) {
          this.navigate(year + '/report/entities-all', {trigger: true});
        } else {
          // back to start
          this.navigate('', {trigger: true});
        }
    },
    // fully qualified >>> display report
    report: function(year, route) {        
        console.log('route:report');
        
        // Parse hash
        var filter = route.split('-');

        app.filter = app.filter || new models.Filter();
        app.filter.set({year:year,report:filter[0],id:filter[1]});           
        
        // load views if not already loaded
        app.viewsIntro    = app.viewsIntro     || new views.Intro({ el: $("#intro") });
        app.viewsTools    = app.viewsTools     || new views.Tools({ el: $("#tools"), model:app.filter });
        app.viewsOverview = app.viewsOverview  || new views.Overview({ el: $("#overview"), model:app.filter });

//        // Load the details view
//        app.viewsDetails && (app.viewsDetails.close ? app.viewsDetails.close() : app.viewsDetails.remove());      
//        app.viewsDetails = new views.Details({ el: $("#details") });
    
    },

  });


//    app.Overview = new views.Overview({ collection:app.Records.byYear(2013).sortBy('score')});
    
    
//    
//    // add the stub HTML required by Flot to hold the graph canvas
//    $("#overview").append( app.Overview.render().el );
//    
//    // show the flot graph
//    app.Overview.renderGraph();
  
  
  /*
   * data_init
   * 
   * set up models and collections
   * 
   * @param {type} data: all spreadsheet data 
   * @returns {undefined}
   */  
  function data_init (data){
    // 1. init years
    app.Years           = new models.Years(data.Years.elements);    
    // 2. init types
    app.Types           = new models.Types(data.Types.elements);    
    // 3. init sizes
    app.Sizes           = new models.Sizes(data.Sizes.elements);    
    // 4. init criteria and criteriaGroups
    app.Criteria        = new models.Criteria(data.Criteria.elements);  
    app.CriteriaGroups  = new models.CriteriaGroups(data.CriteriaGroups.elements);      
    // 5. finally init records
    // for all active years 
    // try to find data, data["year"].elements
    app.Records         = new models.Records();
    app.Years.each(function(year){
      if (year.isActive()) {
        var records = data[year.get('year')].elements;
        _.each(records, function(record){
          record.year = year.get('year');
        });
        app.Records.add(records);   
      }
    });    
    console.log('data initialised');
  }
  
  /*
   * storageReady
   * 
   * called when all spreadsheet data is stored 
   *    
   * @param {type} data
   * @param {type} tabletop
   * @returns {undefined}
   */
  function data_loaded(data, tabletop){
    console.log('data loaded');
    // initialise data
    data_init(data);
    // start application
    app.App = new routers.App();
    Backbone.history.start();
  }
  
    // Start the application
  $(function() {
    //Initialise tabletop instance with data, calls data_loaded when all data read
    var tabletop = Tabletop.init({ key: doc_url, parseNumbers : true, callback: data_loaded });
  });  

//  
//  
//  function renderPdf() {   
//      var srcCanvas = plot.getCanvas();
//      var destinationCanvas = document.createElement("canvas");
//      destinationCanvas.width = srcCanvas.width;
//      destinationCanvas.height = srcCanvas.height;
//
//      var destCtx = destinationCanvas.getContext('2d');
//
//      //create a rectangle with the desired color
//      destCtx.fillStyle = "#FFFFFF";
//      destCtx.fillRect(0,0,srcCanvas.width,srcCanvas.height);
//
//      //draw the original canvas onto the destination canvas
//      destCtx.drawImage(srcCanvas, 0, 0);
//      var imgData = destinationCanvas.toDataURL('image/jpeg');
//
//      var doc = new jsPDF('p', 'pt', 'a4');
//
//      doc.addImage(imgData, 'JPEG', 15, 40, 400, 200);
//      doc.output('datauri');
//
//  } 
  
  

  
//});

