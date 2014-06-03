
//$(function() {

  // globals   
  //
  // the pseudo database: all data kept in google spreadsheet   
  var doc_key  = '0AswFq_8FWOlndERBTzlFT1lCY04zWG9UcEQ1VE92eFE',
      doc_url  = 'https://docs.google.com/spreadsheet/pub?hl=en_US&hl=en_US&key='+doc_key+'&output=html',
      URL      = 'http://tmfrnz.github.io/hrc-good-employer',
      models   = {},
      views    = {},
      routers  = {},
      app      = {},
      COLORS = {               
        white         :{r:255,g:255,b:255},
        dark          :{r:97,g:97,b:97},//#616161
        medium         :{r:160,g:160,b:160},//#a0a0a0
        light         :{r:210,g:210,b:210},//#d2d2d2
        lighter       :{r:237,g:237,b:237},//#ededed
        all           :{r:115,g:28,b:31}, // red: #731c1f
        all_light     :{r:210,g:164,b:166},//        
        entity        :{r:36,g:173,b:162}, // turquoise: #24ada2
        entity_light  :{r:203,g:227,b:225},// #cbe3e1       
        type          :{r:163,g:185,b:64}, // green: #a3b940
        type_light    :{r:220,g:227,b:179},//#dce3b3 
        size          :{r:36,g:98,b:132}, // blue: 246284
        size_light    :{r:185,g:195,b:212}, //b9c3d4
      };
  
  /*
   * DATA models & collections: representing the data loaded from spreadsheet
   */
  models.Control = Backbone.Model.extend({
    color : function(is_light,is_hex){
      is_light = typeof is_light !== 'undefined' ? is_light : false;
      is_hex = typeof is_hex !== 'undefined' ? is_hex : false;
      var report = this.get('report');
      var rgb;
      if (report === 'all') {
        rgb = is_light ? COLORS.all_light : COLORS.all;
      } else if (report === 'entity') {        
        rgb = is_light ? COLORS.entity_light : COLORS.entity;
      } else if (report === 'type') {
        rgb = is_light ? COLORS.type_light : COLORS.type;
      } else if (report === 'size') {
        rgb = is_light ? COLORS.size_light : COLORS.size;
      }
      return is_hex ? rgbToHex(rgb) : rgb;
    },
    accordionCloseAll : function (){
      $('.accordion').removeClass('open');
      $('.accordion-bottom').slideUp();
    }
  });
  // YEARS
  //
  // Model:
  // Year-specific data for all entities, based on sheet 'Year' of the google spreadsheet 
  // each year row references a year-specific sheet that holds all year- and entity specifc information
  models.Year = Backbone.Model.extend({
    initialize : function(){
      //remove any hidden characters that may come from the original data, best replace other fields to
      this.set('summaryoverview',this.get('summaryoverview').replace(/[^\u0000-\u007E]/g, ' ').replace('  ',' '));      
      this.set('summarygeref',this.get('summarygeref').replace(/[^\u0000-\u007E]/g, ' ').replace('  ',' '));      
      this.set('summaryeeoref',this.get('summaryeeoref').replace(/[^\u0000-\u007E]/g, ' ').replace('  ',' '));      
      this.set('summarygeelements',this.get('summarygeelements').replace(/[^\u0000-\u007E]/g, ' ').replace('  ',' '));      
      this.set('summaryreview',this.get('summaryreview').replace(/[^\u0000-\u007E]/g, ' ').replace('  ',' '));      
      this.set('summarywp',this.get('summarywp').replace(/[^\u0000-\u007E]/g, ' ').replace('  ',' '));      
      this.set('summaryparticipation',this.get('summaryparticipation').replace(/[^\u0000-\u007E]/g, ' ').replace('  ',' '));      
    },
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
    byYears : function(years){
      var filtered = this.filter(function(year_model) {
        return ($.inArray(year_model.get("year").toString(),years) > -1);
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
    model: models.Type,
    initialize: function() {
      this.sort_key = 'title';
      this.sort_dir = 'asc';
    },
    byRecords : function (records) {
      var filtered = this.filter(function(type) { 
        return (records.hasType(type.get('id')));
        //return (Math.ceil(staffno) >= size.get('min') && Math.ceil(staffno) <= size.get('max') );
      }); 
      return new models.Types(filtered);      
    },
    // allow sorting by score and alphabetically       
    comparator: function(a, b) {
      var flip = this.sort_dir === 'asc' ? 1 : -1;
        a = a.get(this.sort_key).toLowerCase();
        b = b.get(this.sort_key).toLowerCase();
        return flip *
               ((a > b) ?  1
              : (a < b) ? -1
              :            0);
    },
    // get sorted collection 
    sortBy: function(key,direction){
      direction = typeof direction !== 'undefined' ? direction : 'asc';
      this.sort_key = key;
      this.sort_dir = direction;
      return this.sort();
    },            
  });
  
  // SIZES CATEGORISATION
  // 
  // Defines staff size categories, based on sheet 'Sizes' of the google spreadsheet 
  models.Size = Backbone.Model.extend({});
  models.Sizes = Backbone.Collection.extend({        
    model: models.Size,
    bySize : function (staffno) {
      var filtered = this.filter(function(size) { 
        return (Math.ceil(staffno) >= size.get('min') && Math.ceil(staffno) <= size.get('max') );         
      }); 
      return new models.Sizes(filtered);
    },
    byRecords : function (records) {
      var filtered = this.filter(function(size) { 
        return (records.hasSize(size.get('min')));
        //return (Math.ceil(staffno) >= size.get('min') && Math.ceil(staffno) <= size.get('max') );
      }); 
      return new models.Sizes(filtered);
    }            
  });
  
  // CRITERIA
  // 
  // Defines entity criteria, based on sheet 'Criteria' of the google spreadsheet 
  // Criterion ID field references column name of 'records'
  models.Criterion = Backbone.Model.extend({
    initialize: function(){
      this.set('id',this.get('id').replace('_',''));      
    },
  });
  models.Criteria = Backbone.Collection.extend({        
    model: models.Criterion,
    // the score points achievable
    // currently 1 point for each criterion
    getMax : function(){
      return this.length;
    },
    // filter by year        
    byGroup : function(group_id){           
      var filtered = this.filter(function(record) {
        return record.get("criteriongroupid") === group_id;
      });
      return new models.Criteria(filtered);            
    },            
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
  models.CriteriaGroups = Backbone.Collection.extend({model: models.CriteriaGroup}); 
  
  // RECORDS
  //
  // The scores for each year and entity, based on the year specific sheets of the google spreadsheet (one for each year)
  // Field entity ID connects entities' scores over multiple years
  models.Record = Backbone.Model.extend({
    initialize: function(){
      this.set('typeid',this.get('typeid').trim());
      //remove any hidden characters that may come from the original data, best replace other fields to
      this.set('summaryoverview',this.get('summaryoverview').replace(/[^\u0000-\u007E]/g, ' ').replace('  ',' '));
      if (this.get('size')==='')this.set('size',0);
      if (this.get('type')==='')this.set('type','NS');      
    },
    // check if the record is active, always returns active
    isActive: function(isActive){
      isActive = typeof isActive !== "undefined" ? isActive : true;
      return (this.get('active')) === 'TRUE' ? true : !isActive;              
    },        
    // calculate score score, return as points or percentage
    getScore : function(isPercentage){
      isPercentage = typeof isPercentage !== "undefined" ? isPercentage : false;
      var score = 0;
      var model = this;
      //count points for each criterion
      app.Criteria.each(function(criterion){
        score += model.getCriterionScore(criterion.id);
      });
      if (isPercentage){
        return Math.round((score/app.Criteria.getMax()) * 100);      
      } else {
        return score;
      }
    },
    // get score of specific criterion, usually 0 or 1
    getCriterionScore : function(criterion_id){      
      return ($.isNumeric(this.get(criterion_id))) ? this.get(criterion_id) : 0;
    },
    // calculate score for a criteria group, return as points or percentage
    getGroupScore : function(groupid, isPercentage){
      isPercentage = typeof isPercentage !== "undefined" ? isPercentage : false;
      
      var score = 0;
      var count = 0;
      var model = this;
      //count points and number of criteria for group
      app.Criteria.each(function(criterion){
        if (criterion.get('criteriongroupid') === groupid){
          score += model.getCriterionScore(criterion.id);
          count++; // maybe better reference group count
        }
      });      
      if (isPercentage){
        return Math.round((score/count) * 100);      
      } else {
        return score;
      }
    },
    // get rank of an entity 
    getRank : function(){
      // rank is the number of entities with a greater score plus 1
      // eg no one better >>> rank 1
      // eg 10 entities with better score >>> rank 11
      return app.Records.byScore(this.get('year'),this.getScore()).length + 1;
    },   
    getScoreChange : function(isPercentage, year){
      isPercentage = typeof isPercentage !== "undefined" ? isPercentage : false;
      // defaults to previous year
      year = typeof year !== "undefined" ? year : this.get('year')-1;
      //get record for specified year and same entity id
      // get score of year to compare
      var preRecord = app.Records.byEntity(this.get('entityid')).byYear(year).models[0];
      if (typeof preRecord !== "undefined"){
         return this.getScore(isPercentage) - preRecord.getScore(isPercentage);
      } else {
        return false;
      }
    },
    getRankChange : function(year){
      // defaults to previous year
      year = typeof year !== "undefined" ? year : this.get('year')-1;
      //get record for specified year and same entity id
      // get score of year to compare
      var preRecord = app.Records.byEntity(this.get('entityid')).byYear(year).models[0];
      if (typeof preRecord !== "undefined"){
         return -1 * (this.getRank() - preRecord.getRank()); // positive rank change > improvement
      } else {
        return false;
      }
    },  
    getStaffNo : function(){     
      return this.get('staffno');
    },
    getTypeTitle : function(){
      return app.Types.findWhere({id : this.get('typeid')}).get('title');      
    },
    getStaffTitle : function(){
      return (this.get('staffno') > 0) ? this.get('staffno') : 'Not specified';      
    },
    getStaffCatTitle : function(){
      return app.Sizes.bySize(this.get('staffno')).first().get('title');      
    },
    getSummary : function(){
      return (this.get('summaryoverview') !== '') ? this.get('summaryoverview') : app.Years.byYear(this.get('year')).models[0].get('summaryoverview');
    }
  });
  // the record collection - holds all records for all entities and years
  models.Records = Backbone.Collection.extend({        
    model: models.Record,
    //
    initialize: function() {
      this.sort_key = 'title';
      this.sort_dir = 'asc';
    },
    // allow sorting by score and alphabetically       
    comparator: function(a, b) {
      var flip = this.sort_dir === 'asc' ? 1 : -1;
      if (this.sort_key === 'score'){
        a = a.getScore();
        b = b.getScore();
        return flip *
               ((a > b) ?  1
              : (a < b) ? -1
              :            0);
      } else {
        a = a.get(this.sort_key).toLowerCase();
        b = b.get(this.sort_key).toLowerCase();
        return flip *
               ((a > b) ?  1
              : (a < b) ? -1
              :            0);             
      }
    },
    // get sorted collection 
    sortBy: function(key,direction){
      direction = typeof direction !== 'undefined' ? direction : 'asc';
      this.sort_key = key;
      this.sort_dir = direction;
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
        return record.isActive(isActive) 
              && record.get('typeid') === type;        
      });
      return new models.Records(filtered);
    },
    hasType : function(type){
      return typeof this.findWhere({'typeid':type}) !== 'undefined';
    },
    hasSize : function(size){      
      return this.bySize(size).length > 0;
    },
    //filter by similar size category
    bySize : function(staffno, isActive){
      isActive = typeof isActive !== "undefined" ? isActive : true;      
      var filtered = this.filter(function(record) { 
        var sizemin = 0;
        var sizemax = 0;
        app.Sizes.each(function(size){
          if (Math.ceil(staffno) >= size.get('min') && Math.ceil(staffno) <= size.get('max') ){
            sizemin = size.get('min');
            sizemax = size.get('max');
          }
        });
        return record.isActive(isActive) 
            && Math.ceil(record.getStaffNo()) >= sizemin 
            && Math.ceil(record.getStaffNo()) <= sizemax;
      }); 
      return new models.Records(filtered);
    },
    // filter by score, minimum score or range (min/max)
    byScore : function (year,min,max,isActive){
      max = typeof max !== "undefined" ? max : 0;
      isActive = typeof isActive !== "undefined" ? isActive : true;      
      
      var filtered = this.filter(function(record) { 
        if (max !== 0){
          return record.isActive(isActive) && record.getScore() > min && record.getScore() <= max && record.get("year") === year;
        } else {
          return record.isActive(isActive) && record.getScore() > min && record.get("year") === year;
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
      // for all records, update scores and count, also calculates percentage each step << this could be done more efficiently
      this.each(function(record){
        //only active records
        if (record.isActive()){
          var year = record.get('year');
          //if key (year) present add scores
          if (year in results) {      
            if (filters.criterion !== 'all' ){
              results[year].score += record.getCriterionScore(filters.criterion);
            } else if (filters.group !== 'all' ){
              results[year].score += record.getGroupScore(filters.group);
            } else {
              results[year].score += record.getScore();
            }
            results[year].count++;
          // else need to add key first
          } else {
            results[year] = {};
            results[year].year = year;
            if (filters.criterion !== 'all' ){
              results[year].score = record.getCriterionScore(filters.criterion);
            } else if (filters.group !== 'all' ){
              results[year].score = record.getGroupScore(filters.group);
            } else {
              results[year].score = record.getScore();
            }              
            results[year].count = 1;
          }            
          results[year].percentage = Math.round(((results[year].score/results[year].count)/no_criteria) * 100);          
        }
      });
      return results;      
    },
    
    
  });
  

  /*
   * VIEWS
   */    
  
  /*
   * views.Tools
   */ 
  views.Tools = Backbone.View.extend({
    initialize: function () {                
        this.render();
        this.listenTo(this.model, 'change', this.render);
    },
    render: function(){      
      var records = app.Records.byYear(parseInt(this.model.get('year')));
      var variables = {
        entities        : records.models,
        types           : app.Types.byRecords(records).sort().models,
        sizes           : app.Sizes.byRecords(records).models,
        years           : (this.model.get('report') === "entity") 
? app.Years.active().byYears(Object.keys(app.Records.byEntity(parseInt(this.model.get('id'))).getResults())).models
: app.Years.active().models,        
        allActive       : (this.model.get('report') === "all" ) ? 'active' : '',
        entityActiveID  : (this.model.get('report') === "entity") ? this.model.get('id') : '',        
        typeActiveID    : (this.model.get('report') === "type") ? this.model.get('id') : '',
        sizeActiveMin   : (this.model.get('report') === "size") ? this.model.get('id') : -1,
        yearActive      : parseInt(this.model.get('year'))
      };
      this.$el.html(this.template($.extend(variables,{select_width:178})));
     
      
      this.$('select#entity').select2({
          placeholder: "Entity",
          allowClear:true
        });
      this.$('select#type').select2({
          placeholder: "Type",
          allowClear:true,
          minimumResultsForSearch: 99  // disable search box
        });
      this.$('select#size').select2({
          placeholder: "Size",
          allowClear:true,
          minimumResultsForSearch: 99
        });
      this.$('select#year').select2({
          minimumResultsForSearch: 99
        });
      
      this.initFullscreen();
      return this;      
    },            
    events : {
      "click #all"      : "selectAll",
      "click #renderPdf": "renderPdf",
      "change #entity"  : "selectEntity", 
      "change #type"    : "selectType", 
      "change #size"    : "selectSize", 
      "change #year"    : "selectYear", 
    },
    selectAll: function( event ){
      event.preventDefault();
      app.App.navigate(this.model.get('year') + '/report/all-entities', {trigger: true});
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
    renderPdf: function( event ){
        event.preventDefault();
        renderPdf();
    },
    template: _.template('\
<div class="row">\n\
<h4 class="medium pull-left">Select Report</h4>\n\
<a href="#" class="fullscreen hidden-fullscreen hidden-standalone pull-right" data-toggle="fullscreen">Enter fullscreen <span class="icon-fullscreen-open"></span></a>\
<a href="#" class="fullscreen visible-fullscreen hidden-standalone pull-right" data-toggle="fullscreen-close">Exit fullscreen <span class="icon-fullscreen-close"></span></a>\n\
</div>\n\
<div class="row" id="report-select"><button id="all" class="btn <%= allActive %>">All entities</button>\
<select id="entity" class="select2" style="width:<%=select_width%>px;">\
  <option></option>\
  <% var group_label = "A"; %>\n\
  <optgroup label="<%=group_label%>">\n\
  <%_.forEach(entities, function (entity) {%>\n\
    <% if (entity.get("title").charAt(0).toUpperCase() !== group_label) { %>\n\
    <% group_label = entity.get("title").charAt(0).toUpperCase();  %>\n\
    </optgroup><optgroup label="<%=group_label%>">\n\
    <% }  %>\n\
    <option value="<%= entity.get("entityid") %>" <% if (entity.get("entityid") === parseInt(entityActiveID)) { print ("selected") } %> >\
    <%= entity.get("title") %></option>\
  <%})%>\
  </optgroup>\n\
</select>\
<select id="type" class="select2" style="width:<%=select_width%>px;">\
  <option></option>\
  <% _.forEach(types, function (type) {%>\
    <option value="<%= type.get("id") %>" <% if (type.get("id") === typeActiveID) { print ("selected") } %> >\
    <%= type.get("title") %></option>\
  <%})%>\
</select>\
<select id="size" class="select2" style="width:<%=select_width%>px;">\
  <option></option>\
  <% _.forEach(sizes, function (size) {%>\
    <option value="<%= size.get("min") %>" <% if (size.get("min") <= sizeActiveMin && size.get("max") >= sizeActiveMin) { print ("selected") } %> >\
    <%= size.get("title") %></option>\
  <%})%>\
</select>\
<select id="year" class="select2">\
  <% _.forEach(years, function (year) {%>\
    <option value="<%= year.get("year") %>" <% if (parseInt(year.get("year")) === yearActive) { print ("selected") } %>>\
    <%= year.get("year") %></option>\
  <%})%>\
</select></div>\
<div class="row"><a href="#" id="renderPdf" class="pull-right">Download report as pdf <span class="icon-download"></span></a></div>\
    '),
    /* FULLSCREEN   ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/
    initFullscreen : function () {
      // if embedded offer fullacreen
      if (top !== self) {
        $('body').removeClass('standalone');
        var wasFullScreen = fullScreenApi.isFullScreen(),
          resizeTimer;
        $(window).on('resize', function () {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(resized, 300);
        });

        function resized() {
          if (wasFullScreen !== fullScreenApi.isFullScreen()) { // fullscreen mode has changed
            if (wasFullScreen) {
              $('body').removeClass('fullscreen');
              // you have just EXITED full screen
            } else {
              $('body').addClass('fullscreen');
              // you have just ENTERED full screen
            }
            wasFullScreen = fullScreenApi.isFullScreen();
          }
          // if not embedded treat as fullscreen
          if (top === self) {
            $('body').addClass('standalone');
          }
        }

        $("a[data-toggle='fullscreen']").attr("href", URL);
        $("a[data-toggle='fullscreen']").click(function (e) {
          // if embedded and fullscreen support
          // also excluding webkit browsers for now
          var webkit = /webkit/.test(navigator.userAgent.toLowerCase());
          if (top !== self && fullScreenApi.supportsFullScreen && !webkit) {
            e.preventDefault();
            $('html').requestFullScreen();
          }

        });
        $("a[data-toggle='fullscreen-close']").click(function (e) {
          // if embedded and fullscreen support
          if (top !== self && fullScreenApi.supportsFullScreen) {
            e.preventDefault();
            $('html').cancelFullScreen();
          }
        });
      }
      
    }      
  });
  
  /*
   * views.Intro
   */
  models.Intro = Backbone.Model.extend({
    initialize : function(){
      this.minYear = app.Years.getFirst();
      this.maxYear = app.Years.getLast();
      this.title = 'Crown Entities and the Good Employer';
      this.subtitle = 'Annual Report Review '+this.minYear+' to '+this.maxYear;      
      this.summary = 'The Human Rights Comission reviews and analyses the reporting of good employer obligations \
by Crown entities and publishes its findings in an annual report "Crown entities and the Good Employer". \
Its role is to provide Equal Employment Opportunities (EEO) guidance to Crown entities and monitor thier progress.'
    }
  });  
  views.Intro = Backbone.View.extend({
    initialize: function () {
        this.render();
    },
    render: function(){
      this.$el.html(this.template(this.model));
      return this;      
    },
    template: _.template('\
<div class="row">\n\
<div class="col-left">\n\
<h1><%= title %></h1>\n\
<h3><%= subtitle %></h3>\n\
<div class="summary"><p><%= summary %></p></div>\n\
</div>\n\
<div class="col-right">\n\
<a class="home-link" href="#" title="Crown Entities and the Good Employer: Home"></a>\n\
</div>\n\
</div>'),
    renderPdf: function (writer){
      console.log('intro.renderpdf');

      writer.addText(this.model.title,'intro_title');
      writer.addText(this.model.subtitle,'intro_subtitle');     
      writer.addText(this.model.summary,'intro_summary');     
      writer.addLine('intro_line');
      writer.addImage('intro_logo','intro_logo');
       
    }
  });

 /* 
  * views.Overview
  */
  models.Overview = Backbone.Model.extend({
    initialize: function(){
      this.set('updated',0);
      this.set('resultsAll', app.Records.getResults());
      this.resetFields();
    },
    update : function(){
      this.currentYear = parseInt(app.Control.get('year'));
      this.currentYearData = app.Years.byYear(this.currentYear).first();     
      this.currentCount = this.get('resultsAll')[this.currentYear].count;
      
      this.set({
        year: this.currentYear,
        graphCollectionActive : null,
        graphCollection : app.Records.byYear(this.currentYear).sortBy('title','desc').sortBy('score','asc')
      });            
      
      this.resetFields();
      
      // depending on report 
      // all entities
      if (app.Control.get('report') === "all") {                                   
        // top
        this.set({
          title: 'All entities',
          subtitle : 'This report provides an overview of the compliance of all Crown entities',
        // bottom
          score : this.get('resultsAll')[this.currentYear].percentage,
          score_label : 'Average compliance',
          rank_label : 'Total number of Crown entities',
          rank : this.currentCount,
          summary : this.currentYearData.get('summaryoverview'),
          modelAverages : new models.Averages({}),
          modelAveragesTime : new models.AveragesTime({
            all: this.get('resultsAll')
          }),
        });
        
      } 
      
      // individual entity
      else if (app.Control.get('report') === "entity") {
        var entityID = parseInt(app.Control.get('id'));
        var entityRecords = app.Records.byEntity(entityID);
        var entitiesByYear = entityRecords.byYear(this.currentYear);
        if (entitiesByYear.length === 0) {
          
        } else {
          this.set('graphCollectionActive', entitiesByYear);
          var entity = this.get('graphCollectionActive').first();

          var resultsType = app.Records.byType(entity.get('typeid')).getResults();
          var resultsSize = app.Records.bySize(entity.getStaffNo()).getResults();

          var scoreChange = '';
          var scoreChangeClass = '';
          if (entity.getScoreChange(true) !== false) {
            scoreChange = entity.getScoreChange(true);
            scoreChangeClass = scoreChange > 0 ? 'up' : scoreChange < 0 ? 'down' : 'same';
          }
          
          var rankChange = '';                             
          var rankChangeClass = '';
          if (entity.getRankChange() !== false) {
            rankChange = entity.getRankChange();
            rankChangeClass = rankChange > 0 ? 'up' : rankChange < 0 ? 'down' : 'same';
          }          
          //prepare models for averages views
          this.set({
            modelAverages : new models.Averages({
              all: this.get('resultsAll')[this.currentYear].percentage,
              type:resultsType[this.currentYear].percentage,
              size:resultsSize[this.currentYear].percentage
            }),
            modelAveragesTime : new models.AveragesTime({
              all: this.get('resultsAll'),
              type:resultsType,
              size:resultsSize,
              entity:entityRecords.getResults(), 
              type_label  : 'Same type: ' + entity.getTypeTitle(), 
              size_label  : 'Same Size: ' + entity.getStaffCatTitle(), 
              entity_label: 'Entity: ' + entity.get('title'),        
            })
          });        

          
          // top
          this.set({
            title : entity.get('title'),
            subtitle : entity.get('explanation'),          
            type_label : 'Type',
            type : entity.getTypeTitle(),
            size_label : 'Size',
            size : entity.getStaffCatTitle(),            
            // bottom
            score : entity.getScore(true),
            score_change : scoreChange,
            score_change_class : scoreChangeClass,
            rank_label : 'Rank',
            rank : entity.getRank(),
            rank_of : ' of ' + this.currentCount + ' entities',
            rank_change : rankChange,
            rank_change_class : rankChangeClass,
            summary : entity.getSummary(),            
          });          
        }
      }
      
      // type or size category report
      else if (app.Control.get('report') === "type" || app.Control.get('report') === "size") {
        var cat, recordsCat, resultsCat;
        // type category report
        if (app.Control.get('report') === "type") {          
          
          var typeID = app.Control.get('id');
          cat = app.Types.findWhere({id:typeID});
          recordsCat = app.Records.byType(typeID);
          resultsCat = recordsCat.getResults(); 
          //prepare models for averages views
          this.set({
            title : 'Category: '+cat.get('title'),
            modelAverages : new models.Averages({
              all: this.get('resultsAll')[this.currentYear].percentage,
            }),
            modelAveragesTime : new models.AveragesTime({
              all: this.get('resultsAll'),
              type:resultsCat,
              type_label:cat.get('title')
            })
          });
        } 
        // size category report
        else if (app.Control.get('report') === "size") {
          var sizeID = app.Control.get('id');
          cat = app.Sizes.bySize(sizeID).first();
          recordsCat = app.Records.bySize(sizeID);
          resultsCat = recordsCat.getResults();
          
          //prepare models for averages views
          this.set({
            title : 'Category: ' + cat.get('title'),            
            modelAverages : new models.Averages({
              all: this.get('resultsAll')[this.currentYear].percentage,
            }),
            modelAveragesTime : new models.AveragesTime({
              all: this.get('resultsAll'),
              size:resultsCat,
              size_label:(cat.get('title'))
            })
          });
        } 
        this.set({
          graphCollectionActive : recordsCat.byYear(this.currentYear),    
          subtitle : 'This report provides an overview of the compliance of selected category',
        // bottom
          score_label : 'Average compliance',
          score : resultsCat[this.currentYear].percentage,
          rank_label : 'Number of entities in category',
          rank : recordsCat.byYear(this.currentYear).length,
          rank_of : ' of ' + this.currentCount + ' entities total',
          summary : this.currentYearData.get('summaryoverview'),
        });
        
        if (typeof resultsCat[this.currentYear-1] !== 'undefined') {
          var diff = resultsCat[this.currentYear].percentage-resultsCat[this.currentYear-1].percentage;
          this.set('score_change',diff);
          this.set('score_change_class',diff > 0 ? 'up' : diff < 0 ? 'down' : 'same');
        }        
      }      
      this.set('report',app.Control.get('report'));
      // triggers the view rendering
      this.set('updated',app.Control.get('report')+app.Control.get('id')+app.Control.get('year'));
    },
    resetFields: function(){      
      this.set({
        title : '',
        subtitle : '',
        type_label : '',
        type : '',
        size_label : '',
        size : '',
        score_label : 'Overall compliance',
        score : '',
        score_change : '',
        score_change_class : '',
        rank_label : '',
        rank : '',
        rank_of : '',
        rank_change : '',
        rank_change_class : '',
        summary : '',
      })
    },
            
  });
  views.Overview = Backbone.View.extend({
    initialize: function () {
        this.subviews = {};
        this.render();
        this.listenTo(this.model, 'change:updated', this.render);        
    },  
    events : {
      "click .accordion-toggle" : "accordionToggle",      
    },
    accordionToggle: function (event) {
      event.preventDefault();
       if (this.$('.accordion').hasClass('open')){
         this.accordionClose();
       } else {
          app.Control.accordionCloseAll();
          this.accordionOpen();
       }
    },
    accordionOpen:function(){      
      var that = this;
      this.$('.accordion-bottom').slideDown(function (){
        that.$('.accordion').addClass('open');      
      });      
    },
    accordionClose:function(){  
      var that = this;    
      this.$('.accordion-bottom').slideUp(function(){
        that.$('.accordion').removeClass('open');
      });      
    },
    render: function() {
      
      this.$el.html(this.template(this.model.attributes));
      
      
      // subview overview graph
      this.subviews.graphView = new views.OverviewGraph({ 
        collection        : this.model.get('graphCollection'),
        collectionActive  : this.model.get('graphCollectionActive'),
        axis_label            : 'Compliance'
      });
      this.$('#overview-graph').append( this.subviews.graphView.render().el );
      this.subviews.graphView.renderGraph();
      
      // subview averages 
      this.subviews.averagesView = new views.Averages({model:this.model.get('modelAverages')});
      this.$('.averages-panel').append( this.subviews.averagesView.render().el );      
      
      // subview averages time graph
      this.subviews.averagesGraphView = new views.AveragesTimeGraph({model:this.model.get('modelAveragesTime'),marker:false});
      this.$('#overview-time-graph').append( this.subviews.averagesGraphView.render().el );      
      this.subviews.averagesGraphView.renderGraph();            
      
      return this;
    },
template: _.template('\
<div id="overview-title" class="row">\n\
  <div class="col-left">\n\
<h2><%= title %></h2>\
  <h4 class="medium"><%= subtitle %></h4>\
</div>\n\
<div class="col-right">\n\
<h2 class="year active"><%= year %></h2>\n\
</div>\n\
</div><!-- #overview-title -->\n\
<div id="overview-cat" class="row">\n\
<table><tbody>\n\
<% if (type !== "") {%>\n\
  <tr><td class="label"><%= type_label %> </td><td><%= type %></td></tr>\n\
<% } %>\n\
<% if (size !== "") {%>\n\
  <tr><td class="label"><%= size_label %> </td><td><%= size %></td></tr>\n\
<% } %>\n\
</tbody></table>\n\
</div><!-- #overview-cat -->\n\
<div id="overview-graph"></div><!-- #overview-graph -->\n\
<div id="overview-bottom">\n\
  <div class="accordion open">\n\
  <div class="accordion-top row">\n\
    <a href="#" class="accordion-open accordion-toggle">More</a>\n\
    <a href="#" class="accordion-close accordion-toggle">Less</a>\n\
    <div class="col-left">\n\
      <div class="score-panel">\n\
        <div class="score-label"><%= score_label %></div>\n\
        <div class="score active"><%= score %>%</div>\n\
        <div class="score-change active"><div class="icon-trend <%= score_change_class %>"></div>\n\
          <% if (score_change > 0) {%>+<%}%><%= score_change %>\n\
        </div>\n\
      </div>\n\
    </div>\n\
    <div class="col-right">\n\
      <div class="averages-panel"></div>\n\
    </div>\n\
  </div>\n\
  <div class="accordion-bottom row">\n\
    <div class="col-left">\n\
      <div class="rank-panel">\n\
        <div class="rank-label"><%= rank_label %></div>\n\
        <div class="rank active"><span class="the-rank"><%= rank %></span><span class="rank-of"><%= rank_of %></span></div>\n\
        <div class="rank-change active "><div class="icon-trend <%= rank_change_class %>"></div>\n\
          <% if (rank_change > 0) {%>+<%}%><%= rank_change %>\n\
        </div>\n\
      </div>\n\
      <div class="summary-panel">\n\
        <p><%= summary %></p>\n\
      </div>\n\
    </div>\n\
    <div class="col-right">\n\
      <div id="overview-time-graph"></div><!-- #overview-time-graph -->\n\
    </div>\n\
  </div>\n\
  </div>\n\
</div><!-- #overview-bottom -->\
    '),
    renderPdf: function (writer){
      var highlight = app.Control.color();
      
      console.log('overview.renderpdf');
      var offset = 0;
      var xoffset = 0;
      
      writer.addText(this.model.get('year').toString(),'overview_year',{color : highlight});
      
      offset += writer.addText(this.model.get('title'),'overview_title');
      offset += writer.addText(this.model.get('subtitle'),'overview_subtitle',{offy:offset});
      //offset = (this.model.get('subtitle') !== '') ? 4 : 0;
      if (this.model.get('report') === 'entity') {
        writer.addText(this.model.get('type_label'),'overview_type_label',{offy:offset});
        writer.addText(this.model.get('type'),'overview_type',{offy:offset});
        writer.addText(this.model.get('size_label'),'overview_size_label',{offy:offset});
        writer.addText(this.model.get('size'),'overview_size',{offy:offset});
      }
      writer.addText(this.model.get('score_label'),'overview_score_label');
      writer.addText(this.model.get('score').toString() + '%','overview_score',{color : highlight});
      
      var score_change = this.model.get('score_change');
      
      if (score_change !== ''){
        if (score_change < 0){
          score_change = score_change.toString();          
          writer.addImage('overview_'+this.model.get('report')+'_down','overview_score_trend');
        } else if (score_change > 0){
          score_change = '+' + score_change.toString();
          writer.addImage('overview_'+this.model.get('report')+'_up','overview_score_trend');        
        } else if (score_change == 0){
          score_change = score_change.toString();
          writer.addImage('overview_'+this.model.get('report')+'_same','overview_score_trend');
        }
      }
      writer.addText(score_change,'overview_score_change',{color : highlight});
      
      writer.addLine('overview_score_line');

      writer.addText(this.model.get('rank_label'),'overview_rank_label');
      writer.addText(this.model.get('rank').toString(),'overview_rank',{color : highlight});
      if (this.model.get('rank') < 10 ){
        xoffset = -5;
      }
      writer.addText(this.model.get('rank_of'),'overview_rank_of',{color : highlight,offx:xoffset});

      var rank_change = this.model.get('rank_change');
      
      if (rank_change != ''){
        if (rank_change < 0){
          rank_change = rank_change.toString();          
          writer.addImage('overview_'+this.model.get('report')+'_down','overview_rank_trend');
        } else if (rank_change > 0){
          rank_change = '+' + rank_change.toString();
          writer.addImage('overview_'+this.model.get('report')+'_up','overview_rank_trend');        
        } else if (rank_change > 0){
          rank_change = rank_change.toString();
          writer.addImage('overview_'+this.model.get('report')+'_same','overview_rank_trend');
        }
      }
      writer.addText(rank_change,'overview_rank_change',{color : highlight});
            
      writer.addLine('overview_rank_line');            
      
      //print subviews
      this.subviews.graphView.renderPdf(writer);
      this.subviews.averagesGraphView.renderPdf(writer,'averages_graph');
      
            // skip averages when not 'all' present
      if(this.model.get('modelAverages').get('all') > -1){        
        this.subviews.averagesView.renderPdf(writer,'overview_averages');        
        writer.addText(this.model.get('summary'),'overview_summary');
      } else {        
        writer.addText(this.model.get('summary'),'overview_summary',{offy:-15});
      }
    },             
  });
  views.OverviewGraph = Backbone.View.extend({
    initialize : function (options) {
      this.options = options || {};
      this.ticks = [[0,'0%'],[25,''],[50,'50%'],[75,''],[100,'100%']];
    },
    events : {
      "plotclick .overview-plot" : "plotclick",
      "plothover .overview-plot" : "plothover",
    },            
    attributes: { class: 'overview-graph row' },
    plotOptions: {
      canvas: false,
      yaxis: {
        tickColor:rgbToHex(COLORS.dark),
        color:rgbToHex(COLORS.dark),
        min:0,
        max:100, 
        position:'right',        
        tickLength:5,
        font : {
          color: rgbToHex(COLORS.dark),
          size:13
        },                
      },
      xaxis: {
        tickColor:rgbToHex(COLORS.dark),
        show:false,
      },
      legend: { 
        show: false,
      },      
      grid: { 
        hoverable: true, 
        clickable: true, 
        autoHighlight: true, 
        backgroundColor: '#ffffff',
        show: true,
        aboveData: false,
        margin: 0,
        labelMargin: 10,
        markings: [],
        borderWidth: {top:0,right:1,bottom:1,left:0},
        borderColor: rgbToHex(COLORS.dark),
        color: rgbToHex(COLORS.dark),
        minBorderMargin: 0,
      },
      series: {
        shadowSize : 0,
        bars: {          
          show: true, 
          fill: 1, 
          barWidth: 0.9, 
          align: 'center',
          lineWidth: 0,          
        },
      },
    },

    render: function() {
      this.$el.html(this.template({axis_label:this.options.axis_label}));      
      return this;
    },
            
    renderGraph: function() {

      var options = _.clone(this.plotOptions);
      options.series.highlightColor = rgbToHex(COLORS.all);
      options.yaxis.ticks = this.ticks;
      var data = [];
      var dataActive = [];
      for ( var i=0;i<this.collection.length;i++ ) {
        var model = this.collection.models[i];
        data.push([i, model.getScore(true) ]);
        if (this.options.collectionActive !== null) {
          var modelActive = this.options.collectionActive.findWhere({ entityid: model.get('entityid') });
          if (typeof modelActive !== "undefined") {
            dataActive.push([i, modelActive.getScore(true) ]);
          } else {
            dataActive.push([i, null]);
          }
        }
      }
            
      options.xaxis.min = -1;
      options.xaxis.max = this.collection.length + 1;

      var dataset = [{ data : data, bars : {fillColor:app.Control.color(true,true)} },{ data : dataActive, bars : {fillColor:app.Control.color(false,true)}}];

      // Now, the chart can be drawn ...
      this.plot = $.plot( this.$('.overview-plot'), dataset, options );

    },
    
    renderPdf: function(writer){
      writer.addPlot(this.plot.getCanvas(),'overview_graph');
      writer.addText(this.options.axis_label,'overview_graph_axis_label');
      var item_graph = writer.item('overview_graph');
      for (var i = 0;i<this.ticks.length;i++){
        writer.addText(this.ticks[this.ticks.length-1-i][1],'overview_graph_ticks',{offy:item_graph.h*0.89/(this.ticks.length-1)*i});        
      }
        
    },
    plotclick : function(event, pos, item){
      console.log('plotclick');
      event.preventDefault();
      // there must be a better way
      if ( item ) {        
        app.App.navigate(
            app.Control.get('year') 
              + '/report/entity-' 
              + this.collection.models[item.dataIndex].get('entityid'), 
            {trigger: true});
      }
    },
    plothover : function(event, pos, item){
      console.log('plothover');
      var ofsh, ofsw;
 
      if ( this.hoverTip )
         this.hoverTip.remove();
      if(item) {
          document.body.style.cursor = 'pointer';
      } else {
          document.body.style.cursor = 'default';
      }
      if (item) {
        var yoffset = item.dataIndex/this.collection.length;
        
        this.hoverTip = $(this.toolTipHTML( 
                item.series.data[item.dataIndex], 
                this.collection.models[item.dataIndex],
                (yoffset * 100)));

        this.$('.overview-plot').parent().append(this.hoverTip);

        ofsh = this.hoverTip.outerHeight();
        ofsw = this.hoverTip.outerWidth();

        this.hoverTip.offset({
          left: item.pageX - ofsw * yoffset,
          top: item.pageY - ofsh - 5
        });
      }      
    },
    toolTipHTML :function( stat, series , yoffset) {

      var html = '';

      html += '<div class="tooltip">';
      html += '<div class="tooltip-inner-wrap">';

      if ( series )
         html += '<div class="series"><strong>'+series.get('title')+'</strong></div>';

      html += '<div class="stats">Compliance: '+stat[1]+'%</div>';
      html += '<div class="stats">Rank: '+series.getRank()+'</div>';
      html += '</div>';
      //html += '<div class="tooltip-after" style="left:'+yoffset+'%">';
      html += '</div>';
      html += '</div>';
      html += '<style>.tooltip:after {left:'+yoffset+'%;}</style>';


      return html;

   },
    template: _.template('\
<div class="plot-wrapper">\n\
<div class="xaxis-label"><%= axis_label %></div>\n\
<div class="overview-plot"></div>\n\
</div>\
')           
  });
  
  models.Details = Backbone.Model.extend({
    initialize: function(){      
      this.set('updated',0);
      this.results = {};
      this.results.all = app.Records.getResults();
      this.results.all_geref = app.Records.getResults({criterion:'geref'});
      this.results.all_ge = app.Records.getResults({group:'GE'});

      this.results.all_wp = app.Records.getResults({group:'WP'});
      this.results.all_eeoref = app.Records.getResults({criterion:'eeoref'});
      this.results.all_review = app.Records.getResults({criterion:'review'});
      this.results.all_participation = app.Records.getResults({criterion:'participation'});
      this.resetFields();
    },
    update : function(){
      this.currentYear = parseInt(app.Control.get('year'));
      this.currentYearData = app.Years.byYear(this.currentYear).first();
      this.currentCount = this.results.all[this.currentYear].count;
      
      this.resetFields();
      var results = {
        geref : {},
        ge : {},
        eeoref : {},
        review : {},
        wp : {},
        participation : {},
      };
      var sizeRecords,typeRecords;
      var that = this;
      if (app.Control.get('report') === "entity") {                                   
        var entityID = parseInt(app.Control.get('id'));
        var entityRecords = app.Records.byEntity(entityID);        
        var entitiesByYear = entityRecords.byYear(this.currentYear);
        if (entitiesByYear.length === 0) {
          
        } else {      
          var entity = entitiesByYear.first();
          typeRecords = app.Records.byType(entity.get('typeid'));
          sizeRecords = app.Records.bySize(entity.getStaffNo());
          results.geref.entity = entityRecords.getResults({criterion:'geref'});
          results.ge.entity = entityRecords.getResults({group:'GE'});
          results.ge.entity_elements = [];
          _.each(app.Criteria.byGroup('GE').models, function(criterion){
            results.ge.entity_elements.push({
              id:criterion.get('id'),
              title:criterion.get('title'),
              results:entitiesByYear.getResults({criterion:criterion.get('id')})
            });
          });
          results.wp.entity = entityRecords.getResults({group:'WP'});
          results.wp.entity_elements = [];
          _.each(app.Criteria.byGroup('WP').models, function(criterion){
            results.wp.entity_elements.push({
              id:criterion.get('id'),
              title:criterion.get('title'),
              results:entitiesByYear.getResults({criterion:criterion.get('id')})
            });
          });
          results.eeoref.entity = entityRecords.getResults({criterion:'eeoref'});
          results.review.entity = entityRecords.getResults({criterion:'review'});
          results.participation.entity = entityRecords.getResults({criterion:'participation'});
        }
      }                              
      else if (app.Control.get('report') === "type") {          
        var typeID = app.Control.get('id');        
        typeRecords = app.Records.byType(typeID);        
      } 
      // size category report
      else if (app.Control.get('report') === "size") {
        var sizeID = app.Control.get('id');        
        sizeRecords = app.Records.bySize(sizeID);        
      }
      
      results.geref.all = this.results.all_geref;
      results.ge.all = this.results.all_ge;
      results.ge.all_elements = [];
      _.each(app.Criteria.byGroup('GE').models, function(criterion){
        results.ge.all_elements.push({
          id:criterion.get('id'),
          title:criterion.get('title'),
          results:app.Records.byYear(that.currentYear).getResults({criterion:criterion.get('id')})
        });
      });
      results.wp.all = this.results.all_wp;     
      results.wp.all_elements = [];
      _.each(app.Criteria.byGroup('WP').models, function(criterion){
        results.wp.all_elements.push({
          id:criterion.get('id'),
          title:criterion.get('title'),
          results:app.Records.byYear(that.currentYear).getResults({criterion:criterion.get('id')})
        });
      });      
      results.eeoref.all = this.results.all_eeoref;
      results.review.all = this.results.all_review;
      results.participation.all = this.results.all_participation;          
      
      if (typeof typeRecords !== 'undefined'){
        results.geref.type = typeRecords.getResults({criterion:'geref'});
        results.ge.type = typeRecords.getResults({group:'GE'});
        results.ge.type_elements = [];
        _.each(app.Criteria.byGroup('GE').models, function(criterion){
          results.ge.type_elements.push({
            id:criterion.get('id'),
            title:criterion.get('title'),
            results:typeRecords.byYear(that.currentYear).getResults({criterion:criterion.get('id')})
          });
        });        
        results.wp.type = typeRecords.getResults({group:'WP'});
        results.wp.type_elements = [];
        _.each(app.Criteria.byGroup('WP').models, function(criterion){
          results.wp.type_elements.push({
            id:criterion.get('id'),
            title:criterion.get('title'),
            results:typeRecords.byYear(that.currentYear).getResults({criterion:criterion.get('id')})
          });
        });         
        results.eeoref.type = typeRecords.getResults({criterion:'eeoref'});
        results.review.type = typeRecords.getResults({criterion:'review'});
        results.participation.type = typeRecords.getResults({criterion:'participation'});
      }
      if (typeof sizeRecords !== 'undefined'){
        results.geref.size = sizeRecords.getResults({criterion:'geref'});
        results.ge.size = sizeRecords.getResults({group:'GE'});     
        results.ge.size_elements = [];
        _.each(app.Criteria.byGroup('GE').models, function(criterion){
          results.ge.size_elements.push({
            id:criterion.get('id'),
            title:criterion.get('title'),
            results:sizeRecords.byYear(that.currentYear).getResults({criterion:criterion.get('id')})
          });
        });        
        results.wp.size = sizeRecords.getResults({group:'WP'});     
        results.wp.size_elements = [];
        _.each(app.Criteria.byGroup('WP').models, function(criterion){
          results.wp.size_elements.push({
            id:criterion.get('id'),
            title:criterion.get('title'),
            results:sizeRecords.byYear(that.currentYear).getResults({criterion:criterion.get('id')})
          });
        });        
        results.eeoref.size = sizeRecords.getResults({criterion:'eeoref'});
        results.review.size = sizeRecords.getResults({criterion:'review'});
        results.participation.size = sizeRecords.getResults({criterion:'participation'});
      }
      this.set({
          year: this.currentYear,          
          subview_models : {
            geref : new models.CriteriaDetails({
              criteria : 'single',
              year : this.currentYear,
              id : 'geref',
              report : app.Control.get('report'),
              results : results.geref,
              title : app.Criteria.findWhere({id:'geref'}).get('title').trim(),
              summary : this.currentYearData.get('summarygeref'),
            }),
            ge : new models.CriteriaDetails({
              criteria : 'group',
              year : this.currentYear,
              id : 'ge',
              report : app.Control.get('report'),
              results : results.ge,
              title : app.CriteriaGroups.findWhere({id:'GE'}).get('title').trim(),
              summary : this.currentYearData.get('summarygeelements'),
            }),            
            eeoref : new models.CriteriaDetails({
              criteria : 'single',
              year : this.currentYear,
              id : 'eeoref',
              report : app.Control.get('report'),
              results : results.eeoref,
              title : app.Criteria.findWhere({id:'eeoref'}).get('title').trim(),
              summary : this.currentYearData.get('summaryeeoref'),
            }),
            review : new models.CriteriaDetails({
              criteria : 'single',
              year : this.currentYear,
              id : 'review',
              report : app.Control.get('report'),
              results : results.review,
              title : app.Criteria.findWhere({id:'review'}).get('title').trim(),
              summary : this.currentYearData.get('summaryreview'),
            }),
            wp : new models.CriteriaDetails({
              criteria : 'group',
              year : this.currentYear,
              id : 'wp',
              report : app.Control.get('report'),
              results : results.wp,
              title : app.CriteriaGroups.findWhere({id:'WP'}).get('title').trim(),
              summary : this.currentYearData.get('summarywp'),
            }),            
            participation : new models.CriteriaDetails({
              criteria : 'single',
              year : this.currentYear,
              id : 'participation',
              report : app.Control.get('report'),
              results : results.geref,
              title : app.Criteria.findWhere({id:'participation'}).get('title').trim(),
              summary : this.currentYearData.get('summaryparticipation'),
            }),
          }
        });
      
      // triggers the view rendering
      this.set('updated',app.Control.get('id')+app.Control.get('year'));      
    },
    resetFields : function(){
      this.set({
        subview_models : {}
      });
    },
  });
  views.Details = Backbone.View.extend({
    initialize: function () {
        this.subviews = [];        
        this.render();
        this.listenTo(this.model, 'change:updated', this.render);        
    },
    render: function() {
      this.subviews = [];
      this.$el.html(this.template(this.model.attributes));
      var that = this;
      //subviews
      _.each(this.model.get('subview_models'), function(sub_model){
        var subview = new views.Criterion({model:sub_model});
        that.subviews.push(subview);
        that.$el.append(subview.render().el);
      });
      _.each(this.subviews, function(subview){      
        subview.renderGraphs();
        subview.accordionClose(0);
      });
      return this;
    },
    renderPdf : function (writer, attr){
      console.log('details.renderPdf');
      var detail_items = [writer.item('detail1'),writer.item('detail2')];  
      var pages = [];
      
      //subviews      
      _.each(this.subviews, function(subview){
        var offset = writer.defaults.offsets.criteria[subview.model.get('id')];
        var pos = {
            x:detail_items[offset.p-1].x+offset.x,
            y:detail_items[offset.p-1].y+offset.y
          };
        //make sure page exists
        if (typeof pages[offset.p-1] === 'undefined'){
          pages[offset.p-1] = [];
        }        
        pages[offset.p-1].push({subview:subview,pos:pos});                                        
      });
      //pages
      for (var i = 0;i<pages.length;i++){
        var page = pages[i];
        _.each(page,function(item){
          item.subview.renderPdf(writer,item.pos);
        });        
        if (i < pages.length-1){
          writer.addPage();
        }
      };                 
      return this;      
    },
template: _.template(''),        
  }); 
  
  models.CriteriaDetails = Backbone.Model.extend({
    initialize : function(){  
      var results = this.get('results');
      var currentYear = this.get('year');      
      if (this.get('report') === 'all') { 
        this.set('score',results.all[currentYear].percentage);
        if (this.get('criteria') === 'group'){
          this.set('all_group_elements',results.all_elements);
        }
        this.set('modelAverages', 
          new models.Averages({})
        );
        this.set('modelAveragesTime' , 
          new models.AveragesTime({
            all: results.all,
            legend: false,
          })
        );        
      }      
      else if (this.get('report') === 'entity'){        
        if (this.get('criteria') === 'group'){
          this.set('score',results.entity[currentYear].percentage);
          this.set('entity_group_elements',results.entity_elements);
          this.set('all_group_elements',results.all_elements);
          this.set('type_group_elements',results.type_elements);
          this.set('size_group_elements',results.size_elements);
        } else {
          // round score for single criteria to resolve 'passing' grade
          this.set('score',Math.round(results.entity[currentYear].percentage/100)*100);
        }
        this.set('modelAverages', 
          new models.Averages({
            all: results.all[currentYear].percentage,    
            type:results.type[currentYear].percentage,
            size:results.size[currentYear].percentage
          })
        );
        this.set('modelAveragesTime', 
          new models.AveragesTime({
            all: results.all,
            type:results.type ,
            size:results.size,
            entity:results.entity,
            legend: false,
          })
        );
      }
      else if (this.get('report') === 'type'){
        this.set('score',results.type[currentYear].percentage);
        if (this.get('criteria') === 'group'){
          this.set('all_group_elements',results.all_elements);
          this.set('type_group_elements',results.type_elements);
        }        
        this.set('modelAverages', 
          new models.Averages({
            all: results.all[currentYear].percentage,
          })
        );
        this.set('modelAveragesTime' , 
          new models.AveragesTime({
            all: results.all,
            type:results.type,
            legend: false,
          })
        );
      }
      else if (this.get('report') === 'size'){
        this.set('score',results.size[currentYear].percentage);
        if (this.get('criteria') === 'group'){
          this.set('all_group_elements',results.all_elements);
          this.set('size_group_elements',results.size_elements);
        }        
        this.set('modelAverages', 
          new models.Averages({
            all: results.all[currentYear].percentage,
          })
        );
        this.set('modelAveragesTime' , 
          new models.AveragesTime({
            all: results.all,
            size:results.size,
            legend: false,
          })
        );
      }
    }
  });  

  views.Criterion = Backbone.View.extend({
    initialize: function () {
        this.subviews = {};
    },
    events : {
      "click .accordion-toggle" : "accordionToggle",      
    },
    accordionToggle: function (event) {
      event.preventDefault();
       if (this.$('.accordion').hasClass('open')){
         this.accordionClose();
       } else {
          app.Control.accordionCloseAll();
          this.accordionOpen();
       }
    },
    accordionOpen:function(){   
      var that = this;   
      this.$('.accordion-bottom').slideDown(function (){
        that.$('.accordion').addClass('open');      
      });      
    },
    accordionClose:function(duration){
      duration = typeof duration !== 'undefined' ? duration : 400;
      var that = this; 
      this.$('.accordion-bottom').slideUp(duration,function(){
        that.$('.accordion').removeClass('open');
      });      
    },
    render: function() {
      
      this.$el.html(this.template(this.model.attributes));
      var that = this;
      var is_marker = true;
      if (this.model.get('criteria') === 'group' ) {
        var i = 0;
        _.each(this.model.attributes.all_group_elements,function(all){          

          if (that.model.get('report') === 'all'){
            that.$('.group-elements').append(that.template_elements_all($.extend(all,{year:that.model.attributes.year})));      
          }
          else if (that.model.get('report') === 'entity'){      
            that.$('.group-elements').append(that.template_elements_entity($.extend(that.model.attributes,{index:i})));
          }
          else if (that.model.get('report') === 'type'){      
            that.$('.group-elements').append(that.template_elements_type($.extend(that.model.attributes,{index:i})));
          }
          else if (that.model.get('report') === 'size'){      
            that.$('.group-elements').append(that.template_elements_size($.extend(that.model.attributes,{index:i})));
          }
          i++;
        });
        // no markers for group view
        is_marker = false;
      }
      // subview averages 
      this.subviews.averagesView = new views.Averages({model:this.model.get('modelAverages')});
      this.$('.averages-panel').append( this.subviews.averagesView.render().el );                 
      
      // subview averages time graph
      this.subviews.averagesGraphView = new views.AveragesTimeGraph({model:this.model.get('modelAveragesTime'),marker:is_marker});            
      this.$('.criteria-time-graph').append( this.subviews.averagesGraphView.render().el );                  
      
      return this;
    },
    renderGraphs : function () {
      this.subviews.averagesGraphView.renderGraph();
    },
    renderPdf : function (writer, attr){
      console.log('Criteria.renderPdf');
      writer.addLine('half_line',$.extend(attr,{color:COLORS.dark}));
      writer.addCriteriaTitle(this.model.get('title'),this.model.get('score'),this.model.get('report'),attr);      
      
      if (this.model.get('criteria') === 'single' ) {
        if(this.model.get('modelAverages').get('all') > -1){
          this.subviews.averagesView.renderPdf(writer,'averages',{x:attr.x,y:attr.y+writer.defaults.offsets.averages.single});        
          writer.addText(this.model.get('summary'),'half',{x:attr.x,y:attr.y+writer.defaults.offsets.summary.single});
        } else {
          writer.addText(this.model.get('summary'),'half',{x:attr.x,y:attr.y+writer.defaults.offsets.summary.single - 15});
        }        
      } else if (this.model.get('criteria') === 'group' ) {
     // lets draw the single items
        var that = this;
        var i = 0;
        var elements = [];

        if (this.model.get('report') === 'all'){
          elements = this.model.get("all_group_elements");      
        } else if (this.model.get('report') === 'entity'){
          elements = this.model.get("entity_group_elements");      
        } else if (this.model.get('report') === 'type'){
          elements = this.model.get("type_group_elements");      
        } else if (this.model.get('report') === 'size'){
          elements = this.model.get("size_group_elements");      
        } 
        var yoffset = 20;
        for (var i = 0;i<elements.length;i++){
          var element = elements[i];
          // title, score        
          writer.addGroupCriteria(element.title,element.results[that.model.attributes.year].percentage,this.model.get('report'),{x:attr.x,y:attr.y+yoffset});
          yoffset += 6.5;
          if (i < elements.length-1){
            writer.addLine('half_line',{x:attr.x,y:attr.y+yoffset})
          }
        };

        writer.addLine('half_line',{x:attr.x,y:attr.y+writer.defaults.offsets.averages.group-3});      
      
        // skip averages when not 'all' present
        if(this.model.get('modelAverages').get('all') > -1){
          this.subviews.averagesView.renderPdf(writer,'averages',{x:attr.x,y:attr.y+writer.defaults.offsets.averages.group});        
          writer.addText(this.model.get('summary'),'half',{x:attr.x,y:attr.y+writer.defaults.offsets.summary.group});
        } else {
          writer.addText(this.model.get('summary'),'half',{x:attr.x,y:attr.y+writer.defaults.offsets.summary.group - 15});
        }
      }      
    },            
    template : _.template('\
  <div class="criteria row">\n\
    <div class="accordion">\n\
      <div class="accordion-top row">\n\
        <a href="#" class="accordion-open accordion-toggle">More</a>\n\
        <a href="#" class="accordion-close accordion-toggle">Less</a>\n\
        <div class="col-left">\n\
          <div class="title-score-wrap">\n\
          <div class="title-score">\n\
            <% if (report === "entity" && score === 100) { %>\n\
              <span class="icon-score-pass"></span>\n\
            <% } else if (report === "entity" && score === 0) { %>\n\
              <span class="icon-score-fail"></span>\n\
            <% } else { %>\n\
            <span class="icon-score"></span><span class="the-score"><%= score %>%</span>\n\
            <% } %>\n\
          </div>\n\
          <div class="title"><%= title %></div>\n\
        </div><!-- .title-score-wrap -->\n\
        </div><!-- .col-left -->\n\
        <div class="col-right">\n\
          <div class="averages-panel"></div>\n\
        </div><!-- .col-right -->\n\
      </div><!-- .accordion-top -->\n\
      <div class="accordion-bottom row">\n\
        <% if (criteria === "group") { %><div class="group-elements"></div><% } %>\n\
        <div class="col-left">\n\
          <div class="summary-panel"><%= summary %></div>\n\
        </div><!-- .col-left -->\n\
        <div class="col-right">\n\
          <div class="criteria-time-graph"></div><!-- .criteria-time-graph -->\n\
        </div><!-- .col-right -->\n\
      </div><!-- .accordion-bottom -->\n\
    </div><!-- .accordion-->\n\
  </div><!-- .criteria -->\n\
'), 
    template_elements_all : _.template('\
<div class="item row">\n\
<div class="col-1"><span class="score-all active"><%= results[year].percentage %>%</span></div>\n\
<div class="col-2"><span class="title"><%= title %></span></div>\n\
</div>\n\
'),
    template_elements_entity : _.template('\
<div class="item row">\n\
<div class="col-1">\n\
<% if (entity_group_elements[index].results[year].percentage >= 50 ) { %>\n\
<span class="score-entity"><span class="icon-score-pass-small"></span></span>\n\
<% } else if (entity_group_elements[index].results[year].percentage < 50 ) { %>\n\
<span class="score"><span class="icon-score-fail-small"></span></span>\n\
<% } %>\n\
</div>\n\
<div class="col-2"><span class="title"><%= entity_group_elements[index].title %></span></div>\n\
<div class="col-3"><span class="score-type"><%= type_group_elements[index].results[year].percentage %>%</span></div>\n\
<div class="col-4"><span class="score-size"><%= size_group_elements[index].results[year].percentage %>%</span></div>\n\
<div class="col-5"><span class="score-all"><%= all_group_elements[index].results[year].percentage %>%</span></div>\n\
</div>\
'),
    template_elements_type : _.template('\
<div class="item row">\n\
<div class="col-1"><span class="score-type active"><%= type_group_elements[index].results[year].percentage %>%</span></div>\n\
<div class="col-2"><span class="title"><%= type_group_elements[index].title %></span></div>\n\
<div class="col-3"><span class="score-all"><%= all_group_elements[index].results[year].percentage %>%</span></div>\n\
</div>\
'),
    template_elements_size : _.template('\
<div class="item row">\n\
<div class="col-1"><span class="score-size active"><%= size_group_elements[index].results[year].percentage %>%</span></div>\n\
<div class="col-2"><span class="title"><%= size_group_elements[index].title %></span></div>\n\
<div class="col-3"><span class="score-all"><%= all_group_elements[index].results[year].percentage %>%</span></div>\n\
</div>\
'),
  });
  
 /* 
  * AVERAGES CURRENT YEAR
  */  
  models.Averages = Backbone.Model.extend({
    defaults: {
      title : 'Average compliance of',
      all : -1, 
      type: -1, 
      size: -1, 
      all_label : 'All entities', 
      type_label: 'Same type', 
      size_label: 'Same size', 
      all_color : rgbToHex(COLORS.all),
      type_color : rgbToHex(COLORS.type),
      size_color : rgbToHex(COLORS.size),         
    },    
  }); 
  views.Averages = Backbone.View.extend({
    initialize : function (options) {
      this.options = options || {};
    },
    render : function(){
      console.log('averages.render');
      if (this.model.get('all') > -1 || this.model.get('type') > -1 || this.model.get('size') > -1) {
        this.$el.html(this.template(this.model.attributes));
      }
      return this;      
    },            
    renderPdf: function(writer,item_key,attr){      
      var offset = {x:0,y:0};
      var label_margin = {top:2,right:16};
      
      // add subview title
      offset.y += writer.addText(this.model.get('title'),item_key,attr);
      offset.y += 1; 
      // get item to calculate offsets
      var item = writer.item(item_key,attr);           
      
      if(this.model.get('type') > -1){
        writer.addText(this.model.get('type_label'),'default',{x:item.x+offset.x,y:item.y+offset.y + label_margin.top});
        writer.addText(this.model.get('type')+'%','default',{x:item.x+offset.x + label_margin.right,y:item.y+offset.y + label_margin.top,style:'bold',color:COLORS.type});
        offset.x += writer.addAverageBar(this.model.get('type'),{x:item.x+offset.x,y:item.y+offset.y,color:COLORS.type});        
      }
      if(this.model.get('size') > -1){
        writer.addText(this.model.get('size_label'),'default',{x:item.x+offset.x,y:item.y+offset.y + label_margin.top});
        writer.addText(this.model.get('size')+'%','default',{x:item.x+offset.x + label_margin.right,y:item.y+offset.y + label_margin.top,style:'bold',color:COLORS.size});        
        offset.x += writer.addAverageBar(this.model.get('size'),{x:item.x+offset.x,y:item.y+offset.y,color:COLORS.size});
      }
      if(this.model.get('all') > -1){
        writer.addText(this.model.get('all_label'),'default',{x:item.x+offset.x,y:item.y+offset.y + label_margin.top});
        writer.addText(this.model.get('all')+'%','default',{x:item.x+offset.x + label_margin.right,y:item.y+offset.y + label_margin.top,style:'bold',color:COLORS.all});        
        offset.x += writer.addAverageBar(this.model.get('all'),{x:item.x+offset.x,y:item.y+offset.y,color:COLORS.all});
      }
      offset.y += 9;
      
      writer.addLine('half_line',{x:item.x,y:item.y+offset.y});
    },
    template: _.template('\
    <div class="averages">\n\
      <div class="averages-title"><%=title%></div>\n\
      <ul class="averages-list">\n\
      <% if (type > -1) {%>\n\
      <li>\n\
        <div class="average-type averages-full"><span class="averages-score" style="width:<%=type%>%;background:<%=type_color%>;"></span></div>\n\
        <div><%=type_label%> <%=type%>%</div>\n\
      </li><% }%>\n\
      <% if (size > -1) {%>\n\
      <li>\n\
        <div class="average-size averages-full"><span class="averages-score" style="width:<%=size%>%;background:<%=size_color%>;"></span></div>\n\
        <div><%=size_label%> <%=size%>%</div>\n\
      </li><% }%>\n\
      <% if (all > -1) {%>\n\
      <li>\n\
        <div class="average-all averages-full"><span class="averages-score" style="width:<%=all%>%;background:<%=all_color%>;"></span></div>\n\
        <div><%=all_label%> <%=all%>%</div>\n\
      </li><% }%>\n\
    </div>\n\
    ')            
  });
 /* 
  * AVERAGES OVER TIME
  */    
  models.AveragesTime = Backbone.Model.extend({
    defaults: {
      title : 'Compliance over time',
      all   : {}, 
      type  : {}, 
      size  : {},
      entity: {},
      all_label   : 'All entities', 
      type_label  : 'Same type', 
      size_label  : 'Same size',       
      entity_label: 'Current entity',
      legend:true,
      axis_label: 'Compliance'
    },
  });  
  views.AveragesTimeGraph = Backbone.View.extend({ 
    initialize : function (options) {
      this.options = options || {};
      this.ticks = [[0,'0%'],[50,'50%'],[100,'100%']];
      this.axis_padding = 0.05;
    },
    attributes: { class: 'time-graph'},

    plotOptions: {
      canvas: false,
      yaxis: {
        tickColor:rgbToHex(COLORS.dark),
        color:rgbToHex(COLORS.dark),
        min:0,
        max:100, 
        position:'right',
        tickLength:5,
        font : {
          color: rgbToHex(COLORS.dark),
          size:13
        },
        autoscaleMargin:0
      },
      xaxis: {
        color:rgbToHex(COLORS.dark),
        tickSize:1,
        tickDecimals:0,
        tickLength:0,
        font : {
          color: rgbToHex(COLORS.dark),
          size:13,
          weight:'bold'
        },
        autoscaleMargin:0
      },
      legend: { 
        show: false
      },
      grid: { 
        hoverable: true, 
        clickable: true, 
        autoHighlight: true, 
        backgroundColor: '#ffffff',
        show: true,
        aboveData: false,
        margin: 0,
        labelMargin: 10,
        markings: [],
        borderWidth: {top:0,right:1,bottom:1,left:0},
        borderColor: rgbToHex(COLORS.dark),
        color: rgbToHex(COLORS.dark),
        minBorderMargin: 0,
        axisMargin:0
      },      
      series: {
        shadowSize : 0,
      }
    },
    render: function() {
      this.$el.html(this.template($.extend(this.model.attributes,{cid:this.cid})));
      return this;
    },
    lineOptions:function(report,options){
      var line_width  = 1.7;
      var line_width_main  = 2;
      if (report === 'all') { 
        if(app.Control.get('report') === 'all') {
          return $.extend(options,{lines:{show:true,lineWidth:line_width_main}});
        } else {
          return $.extend(options,{dashes:{show:true,lineWidth:line_width,dashLength:2}});
        }
      }
      else if (report === 'type') { 
        if(app.Control.get('report') === 'type') {
          return $.extend(options,{lines:{show:true,lineWidth:line_width_main}});
        } else {
          return $.extend(options,{dashes:{show:true,lineWidth:line_width,dashLength:5}});
       }
      }
      else if (report === 'size') { 
       if(app.Control.get('report') === 'size') {
          return $.extend(options,{lines:{show:true,lineWidth:line_width_main}});
        } else {
          return $.extend(options,{dashes:{show:true,lineWidth:line_width,dashLength:8}});
        }
      }
      else if (report === 'entity') { 
        return $.extend(options,{lines:{show:true,lineWidth:line_width_main},points : {show: true,fill: true,fillColor:rgbToHex(COLORS.entity)}});
      }
      
    },      
    renderGraph: function() {

      var options = _.clone(this.plotOptions);
      options.yaxis.ticks = this.ticks;
      
      var data = [];
      var dataset = [];
      options.colors = [];    
      
      // axis padding in %      
      var all_keys = Object.keys(this.model.get('all'));
      options.xaxis.max =  Math.max.apply(Math, all_keys)+((all_keys.length-1)*this.axis_padding);
      options.xaxis.min =  Math.min.apply(Math, all_keys)-((all_keys.length-1)*this.axis_padding);
      
      //all entities
      _.each(this.model.get('all'), function(year) { 
        data.push([year.year,year.percentage]);
      });
      dataset.push(
        this.lineOptions('all',{
          data  : data
      }));
      options.colors.push(rgbToHex(COLORS.all));            
      
      data = [];
      //if type
      if (!$.isEmptyObject(this.model.get('type'))){
        _.each(this.model.get('type'), function(year) { 
          data.push([year.year,year.percentage]);
        });
        dataset.push(this.lineOptions('type',{
          data  : data
        }));
        options.colors.push(rgbToHex(COLORS.type));

      }
      data = [];
      //if size
      if (!$.isEmptyObject(this.model.get('size'))){
        _.each(this.model.get('size'), function(year) { 
          data.push([year.year,year.percentage]);
        });
        dataset.push(
        this.lineOptions('size',{
          data  : data
        }));
        options.colors.push(rgbToHex(COLORS.size));
      }
      data = [];
      var dataPass = [];
      var dataFail = [];
      //if entity
      if (!$.isEmptyObject(this.model.get('entity'))){
        var that = this;
        _.each(this.model.get('entity'), function(year) { 
          data.push([year.year,year.percentage]);
          if (that.options.marker){
            if (year.percentage === 100) {
              var img = new Image();
              img.src = 'img/icons/score-entity-pass-mark.png';        
              dataPass.push([img,year.year,year.percentage]);
            }
            else if (year.percentage === 0) {
              var img = new Image();
              img.src = 'img/icons/score-entity-fail-mark.png';        
              dataPass.push([img,year.year,year.percentage]);          
            }
          }
        });
        dataset.push(
          this.lineOptions('entity',{
            data  : data
          }));
        options.colors.push(rgbToHex(COLORS.entity));
          
        if (this.options.marker){          
          dataset.push({data:dataPass,images : {show: true}});
          dataset.push({data:dataFail,images : {show: true}});
          options.colors.push({});
          options.colors.push({}); 
        }

      }
        // Now, the chart can be drawn ...
      this.plot = $.plot( this.$('.time-plot'), dataset, options ); 
      
      if (this.model.get('legend')) {
        $('.plot-wrapper-'+this.cid+' .legend').html(this.template_legend($.extend(this.model.attributes,{report:app.Control.get('report')})));
      }      
    },
    renderPdf: function(writer,item_key,attr){
      writer.addPlot(this.plot.getCanvas(),item_key,attr);
      
      writer.addText(this.model.get('axis_label'),item_key+'_axis_label');
      writer.addText(this.model.get('title'),item_key+'_title');
      var item_graph = writer.item(item_key);
      for (var i = 0;i<this.ticks.length;i++){
        writer.addText(this.ticks[this.ticks.length-1-i][1],item_key+'_ticks',{offy:item_graph.h*0.75/(this.ticks.length-1)*i});        
      }
      var all_keys = Object.keys(this.model.get('all'));
      for (var i = 0;i<all_keys.length;i++){
        // tick_offset = axis_width/no_of_ticks
        var offx = (item_graph.w*0.85*(1-2*this.axis_padding)/(all_keys.length-1)*i)+item_graph.w*0.85*this.axis_padding;
        writer.addText(all_keys[all_keys.length-1-i],item_key+'_xticks',{offx:offx});        
      }
      var item_graph = writer.item(item_key + '_legend');
      
      // legend
      var legend_attr = this.model.attributes;
      var report = app.Control.get('report'); 
    
      var offy = 0;
      var offx = 8;
      if (!$.isEmptyObject(legend_attr.entity)){        
        // draw line main
        writer.addLine(item_key + '_legend_line',{color : COLORS.entity,offy:offy}); 
        // add entity_label
        writer.addText(legend_attr.entity_label,item_key + '_legend',{offx:offx})
        offy += 4;
      }
      if (!$.isEmptyObject(legend_attr.type)){
        if (report === "type"){
          // draw line main 
          writer.addLine(item_key + '_legend_line',{color : COLORS.type,offy:offy});
        } else {
          writer.addLine(item_key + '_legend_line',{color : COLORS.type,offy:offy,dash:0.66});          
        }
        // add type_label
        writer.addText(legend_attr.type_label,item_key + '_legend',{offx:offx,offy:offy});
        offy += 4;        
      }
      if (!$.isEmptyObject(legend_attr.size)){
        if (report === "size"){
          writer.addLine(item_key + '_legend_line',{color : COLORS.size,offy:offy});          
        } else {
          // draw line long-dashed
          writer.addLine(item_key + '_legend_line',{color : COLORS.size,offy:offy,dash:1});
        }
        // add size_label
        writer.addText(legend_attr.size_label,item_key + '_legend',{offx:offx,offy:offy});
        offy += 4;
      }
      // there is always an all line
      if (report === "all"){
        // draw line main
        writer.addLine(item_key + '_legend_line',{color : COLORS.all,offy:offy});        
      } else {
        // draw line dotted
        writer.addLine(item_key + '_legend_line',{color : COLORS.all,offy:offy,dash:0.33});        
      }
      //add all_label
      writer.addText(legend_attr.all_label,item_key + '_legend',{offx:offx,offy:offy})
      
    },
    template: _.template('\
<div class="plot-wrapper plot-wrapper-<%= cid %>">\n\
<div class="averages-title"><%= title %></div>\n\
<div class="xaxis-label"><%= axis_label %></div>\n\
<div class="time-plot"></div>\n\
<div class="legend"></div>\n\
</div>\
'),
    template_legend: _.template('\
    <ul class="legend-list">\
<% if (!$.isEmptyObject(entity)){%>\
<li class="legend-entity <% if (report === "entity"){%>legend-main<% } %>">\n\
<span class="line"></span>\n\
<span class="legend-label"><%=entity_label%></span>\n\
</li>\
<% }%>\
<% if (!$.isEmptyObject(type)){%>\
<li class="legend-type <% if (report === "type"){%>legend-main<% } %>">\n\
<span class="line"></span>\n\
<span class="legend-label"><%=type_label%></span>\n\
</li>\
<% }%>\
<% if (!$.isEmptyObject(size)){%>\
<li class="legend-size <% if (report === "size"){%>legend-main<% } %>">\n\
<span class="line"></span>\n\
<span class="legend-label"><%=size_label%></span>\n\
</li>\
<% }%>\
<li class="legend-all <% if (report === "all"){%>legend-main<% } %>">\n\
<span class="line"></span>\n\
<span class="legend-label"><%=all_label%></span>\n\
</li>\
    </ul>\
    ')            
  });
  
  
  
  views.Footer = Backbone.View.extend({
    initialize: function() {
      this.render();
    },
    render: function() {
      this.$el.html(this.template({}));
    },
    renderPdf: function(writer) {
      writer.addImage('footer','footer_image');
    },
template: _.template('\
    <div class="footer-scene">\n\
    </div>\n\
    ')              
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
          this.navigate(year + '/report/all-entities', {trigger: true});
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
        // create control view
        app.Control    = app.Control || new models.Control();
        //default to all entities
        if ($.inArray(filter[0],['all','entity','type','size']) === -1 || filter[1] === 'none' || filter[1] === '') {
          this.navigate(year + '/report/all-entities', {trigger: true});
        } else {
          console.log('route:report: '+filter[0]+'-'+filter[1]);
          app.Control.set({year:year,report:filter[0],id:filter[1]});
        
          // set report specific classes for css
          $('#report').removeClass (function (index, css) {
            return (css.match (/\breport-\S+/g) || []).join(' ');
          });
          $('#report').addClass('report-'+filter[0]).addClass('report-id-'+filter[1]);

          // create other models if necessary
          app.Overview      = app.Overview       || new models.Overview();
          app.Details       = app.Details        || new models.Details();
          
          $.plot.image.load(['img/icons/score-entity-fail-mark.png','img/icons/score-entity-pass-mark.png'], function(){
          
            // update models >>> trigger view render
            app.Overview.update();
            app.Details.update();

            // create views if necessary
            app.viewsIntro    = app.viewsIntro     || new views.Intro(    { el: $("#intro"),    model: new models.Intro() });
            app.viewsTools    = app.viewsTools     || new views.Tools(    { el: $("#tools"),    model: app.Control });                
            app.viewsOverview = app.viewsOverview  || new views.Overview( { el: $("#overview"), model: app.Overview});
            app.viewsDetails  = app.viewsDetails   || new views.Details(  { el: $("#details"),  model: app.Details});        
            app.viewsFooter   = app.viewsFooter    || new views.Footer(   { el: $("#footer"),   model: app.Control});
          });
        }
    },

  });
  
  
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
    
    showOnLoad('onData');    
  }
  
    // Start the application
  $(function() {
    //Initialise tabletop instance with data, calls data_loaded when all data read
    var tabletop = Tabletop.init({ key: doc_url, parseNumbers : true, callback: data_loaded });
  });  

  
  function renderPdf() {   
      
      // load image data json
      
      $.getJSON('data/imagedata.json',function(imagedata){
        app.docWriter = new models.DocWriter ({images:imagedata});

        app.viewsIntro.renderPdf(app.docWriter);
        app.viewsOverview.renderPdf(app.docWriter);
        app.viewsDetails.renderPdf(app.docWriter);
        app.viewsFooter.renderPdf(app.docWriter);

        app.docWriter.output();
      });   
  } 
  
  models.DocWriter = Backbone.Model.extend({
    initialize : function(){
      this.doc = new jsPDF({lineHeight:this.defaults.lineHeight});           
      this.doc.setFontSize(this.defaults.elements.default.size);
    },     
    defaults : {
      lineHeight:1.4,
      offsets  :{
        averages : {single:23,group:70},
        detail_title :{x:15,y:11},
        summary : {single:42,group:89},      
        criteria : {
          geref         :{p:1,y:0,x:0},
          eeoref        :{p:1,y:0,x:95},
          ge            :{p:2,y:0,x:0},
          wp            :{p:2,y:0,x:95},          
          review        :{p:2,y:130,x:0},
          participation :{p:2,y:130,x:95},
        }
      },
      elements  : { 
        default               : {y:15,x:15,w:180,h:0,size:8,style:'normal',
                                  margin:{top:0,bottom:2,right:0,left:0},color:COLORS.dark,
                                  offy:0,offx:0},        
        half                  : {y:15,x:15,w:85,h:0,size:8,style:'normal',margin:{top:0,bottom:2,right:0,left:0},color:COLORS.dark},        
        intro_title           : {y:15,size:17,style:'bold'},
        intro_subtitle        : {y:24,size:10,style:'bold'},
        intro_summary         : {y:32,w:130},
        intro_logo            : {y:13,x:163,w:32,h:35},
        intro_line            : {y:54,h:0.75,color:COLORS.dark},
        //----------------
        //----------------
        overview_title        : {y:71,w:130,size:16,yalign:'center'},
        overview_subtitle     : {y:70,w:130,color:COLORS.medium},
        overview_year         : {y:63,x:169,size:27,style:'bold'},
        overview_type_label   : {y:71,x:15,style:'bold'},
        overview_type         : {y:71,x:23},
        overview_size_label   : {y:75,x:15,style:'bold'},
        overview_size         : {y:75,x:23},
        //----------------
        overview_score_label  : {y:96,size:10,style:'bold'},
        overview_score        : {y:99,size:40,style:'bold'},
        overview_score_trend  : {y:104,x:53,w:7,h:7},
        overview_score_change   : {y:111,x:54},
        overview_score_line   : {y:117,w:44,h:0.75,color:COLORS.light},
        //----------------
        overview_rank_label   : {y:124,style:'bold',w:44,yalign:'center'},
        overview_rank         : {y:126,size:23,style:'bold'},
        overview_rank_of      : {y:131,x:25},
        overview_rank_trend   : {y:124,x:53,w:7,h:7},
        overview_rank_change    : {y:131,x:54},
        overview_rank_line    : {y:138,w:44,h:0.75,color:COLORS.light},
        //----------------
        overview_graph        : {y:100,x:63,w:132,h:40},        
        overview_graph_axis_label  : {y:96,x:180},      
        overview_graph_ticks  : {y:103.5,x:188,yalign:'center'},
        averages_graph        : {y:149,x:107,w:89,h:30},
        averages_graph_title  : {y:142.5,x:110,style:'bold'},     
        averages_graph_axis_label  : {y:146,x:180},      
        averages_graph_ticks  : {y:152.5,x:188,yalign:'center'},             
        averages_graph_xticks : {y:176,x:107,style:'bold'},             
        averages_graph_legend : {y:183,x:110,size:7},
        averages_graph_legend_line : {y:185,x:110,w:5,h:1},        
        overview_averages     : {y:142.5,w:85,style:'bold'},
        averages              : {w:85,style:'bold'},
        overview_summary      : {y:162,w:85},
        //----------------
        average_line          : {w:22,h:4,margin:{right:6},color:COLORS.light},        
        half_line             : {w:85,h:0.75,color:COLORS.light},
        //----------------
        detail1                : {y:208},
        detail2                : {y:15},
        detail_title           : {style:'bold',w:65,size:11},
        detail_image           : {w:12,h:12},
        detail_image_small     : {w:3,h:3},
        detail_score           : {style:'bold',size:11,color:COLORS.white},
        //----------------
        footer_image           : {y:222,w:180}
      },
      
    },
   
    item : function (key,attr) {
      attr = typeof attr !== 'undefined' ? attr : {};
      
      var item = $.extend({},this.defaults.elements[key]);
      var def = $.extend({},this.defaults.elements.default);
      item = $.extend(item,attr);      
      return $.extend(def,item);
        
    },    

    convert2pt : function (mm){
      return mm * this.doc.internal.scaleFactor;
    },
    convert2mm : function (pt){
      return pt / this.doc.internal.scaleFactor;
    },
    output : function(){
       this.doc.output('datauri');
    },
    addText : function(s,item_key,item_attr){
      if (s === "") return 0;
      item_key = typeof item_key !== 'undefined' ? item_key : 'default';
      var item = this.item(item_key,item_attr);
      var yalign = (item.yalign !== 'undefined') ? item.yalign : 'top';
      //set style
      this.doc.setFontSize(item.size);
      this.doc.setFontStyle(item.style);
      this.doc.setTextColor(item.color.r,item.color.g,item.color.b);
      
      // replace macron
      s = s.toString().replace(/[\u0101]/g,'a');
      
      // check for multiple lines
      var lines = this.doc.splitTextToSize(s, this.convert2pt(item.w/1.3));
      var yoffset = lines.length * this.convert2mm(item.size) * this.defaults.lineHeight + item.margin.bottom;
      if (yalign === 'center') {
        yoffset = yoffset/2;
        item.y -= yoffset;
      }
      this.doc.text(item.x+item.offx,item.y+item.offy + this.convert2mm(item.size),lines);
      
      // return the vertical offset
      return yoffset;

    },
    addLine : function(item_key,item_attr){
      var item = this.item(item_key,item_attr); 
      this.doc.setLineWidth(this.convert2mm(item.h)); 
      this.doc.setDrawColor(item.color.r,item.color.g,item.color.b);
      
      if (typeof item.dash !== 'undefined'){
        var offx = 0;
        for (var i = 0; i < Math.floor(item.w/(item.dash)); i++){
          if (i % 2 === 0) {
            this.doc.line(item.x+offx,item.y+item.offy,item.x+item.dash+offx,item.y+item.offy);
          }
          offx += item.dash;
        }
      } else {
        this.doc.line(item.x,item.y+item.offy,item.x+item.w,item.y+item.offy);
      }
    },
        
    addImage : function(image_key,item_key,image_attr,item_attr){
      image_attr = typeof image_attr !== 'undefined' ? image_attr : {};
      item_attr = typeof item_attr !== 'undefined' ? item_attr : {};
      
      var item = this.item(item_key,item_attr);            
      
      var image = this.get('images')[image_key];      
      image = $.extend(image,image_attr);                                
      
      this.doc.addImage(
        image.data,
        image.format,
        item.x,
        item.y,
        item.w,
        item.h);
    },
    addPlot : function(srcCanvas,item_key,item_attr){
      var item = this.item(item_key,item_attr);      
      var image_scale = 2;
      var w_scaled = srcCanvas.width*image_scale;
      var h_scaled = srcCanvas.height*image_scale;
      var destinationCanvas = document.createElement("canvas");
      destinationCanvas.width = w_scaled;
      destinationCanvas.height = h_scaled;

      var destContext = destinationCanvas.getContext('2d');

      //create a rectangle with the desired color
      destContext.fillStyle = "#FFFFFF";
      destContext.fillRect(0,0,w_scaled,h_scaled);

      //draw the original canvas onto the destination canvas
      destContext.drawImage(srcCanvas, 0, 0, w_scaled,h_scaled);
      
      var imgData = destinationCanvas.toDataURL('image/jpeg');      
      this.doc.addImage(
        imgData,
        'JPEG',
        item.x,
        item.y,
        item.w,
        item.h);
    },
            
    addAverageBar : function(value,item_attr){
      //draw base bar
      
      this.addLine('average_line',{x:item_attr.x,y:item_attr.y});      
      // need to get base line width
      var base = this.item('average_line');
      this.addLine('average_line',{x:item_attr.x,y:item_attr.y,w:base.w*value/100,color:item_attr.color});
      //return horizontal offset
      return base.w + base.margin.right;
      
    },
    addCircle : function(attr){
      this.doc.setFillColor(attr.color.r,attr.color.g,attr.color.b);
      this.doc.circle(attr.x,attr.y,attr.r,'F');      
    },
    addTick : function(attr){      
      this.doc.setLineWidth(1.8); 
      this.doc.setDrawColor(attr.color.r,attr.color.g,attr.color.b);
      this.doc.line(attr.x+3,attr.y+5.69,attr.x+5.62,attr.y+8.31); 
      this.doc.line(attr.x+4.38,attr.y+8.31,attr.x+9,attr.y+3.69);
    },
    addCross : function(attr){      
      this.doc.setLineWidth(1.8); 
      this.doc.setDrawColor(attr.color.r,attr.color.g,attr.color.b);      
      this.doc.line(attr.x+3.69,attr.y+3.69,attr.x+8.31,attr.y+8.31);
      this.doc.line(attr.x+3.69,attr.y+8.31,attr.x+8.31,attr.y+3.69);
    },            
    addCriteriaTitle : function(title,score,report,attr){
      var image_key = 'details_' + report + '_';
      
      var score_offset = 2.2;
      if (score < 10 ) {
        score_offset = 4;
      } else if (score > 99 ) {
        score_offset = 1.2;
      }
      if (report === 'entity' && score === 100 ) {
          this.addCircle({x:attr.x+6,y:attr.y+9.8,r:6,color:COLORS[report]});
          this.addTick({x:attr.x,y:attr.y+4,color:COLORS.white});          
        } else if (report === 'entity' && score === 0 ) {
          this.addCircle({x:attr.x+6,y:attr.y+9.8,r:6,color:COLORS.lighter})
          this.addCross({x:attr.x,y:attr.y+4,color:COLORS.entity});                 
      } else {
        this.addCircle({x:attr.x+6,y:attr.y+9.8,r:6,color:COLORS[report]});
        this.addText(score + '%','detail_score',{x:attr.x+score_offset,y:attr.y+this.defaults.offsets.detail_title.y,yalign:'center'});
      }
      this.addText(title,'detail_title',{x:attr.x+this.defaults.offsets.detail_title.x,y:attr.y+this.defaults.offsets.detail_title.y,yalign:'center'});
      this.addLine('half_line',{x:attr.x,y:attr.y+20});
    },
    addGroupCriteria : function (text,score,report,attr){
      
      if (report === 'entity'){
        var image_key = 'details_entity_';
        if (score >= 50 ) {          
          image_key += 'pass_small';
          this.addImage(image_key,'detail_image_small',{},{x:attr.x+4.5,y:attr.y+2});
        } else if (score < 50 ) {
          image_key += 'fail_small';
          this.addImage(image_key,'detail_image_small',{},{x:attr.x+4.5,y:attr.y+2});
        }
      } else {
        var score_offset = 3;
        if (score < 10 ) {
          score_offset = 4;
        } else if (score > 99 ) {
          score_offset = 1.4;
        }        
        this.addText(score + '%','default',{x:attr.x+score_offset,y:attr.y+1.5,style:'bold'});
      }
      this.addText(text,'default',{x:attr.x+10,y:attr.y+1.5});
    },
    addPage : function (){
      this.doc.addPage();
    }
  });
  
  function showOnLoad(s){
    $('.loading.'+s).hide();
    $('.waiting.'+s).removeClass('waiting').css("visibility","visible");//.hide().show();
  }
  function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
}

  function rgbToHex(rgb) {
      return "#" + componentToHex(rgb.r) + componentToHex(rgb.g) + componentToHex(rgb.b);
  }  


 //});

