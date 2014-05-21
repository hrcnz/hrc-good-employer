
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
    // the score points achievable
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
      this.typeID = this.get('typeid').trim();
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
      return (this.get('staffno') !== '') ? this.get('staffno') : 'Not specified';
    },
    getTypeTitle : function(){
      return (this.typeID !== '') ? app.Types.findWhere({id : this.typeID}).get('title') : 'Not specified';      
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
        a = a.getScore();
        b = b.getScore();
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
              && record.typeID === type;
        } else {
          return record.isActive(isActive) 
              && record.typeID === '';
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
  
  // AVERAGES
  //   
  // Defines type categories, based on sheet 'Types' of the google spreadsheet 
  models.Averages = Backbone.Model.extend({
    defaults: {
      title : 'Average compliance of',
      all : 0, 
      type: 0, 
      size: 0, 
      all_label : 'All entities', 
      type_label: 'Same type', 
      size_label: 'Same size', 
    },
  }); 
  // AVERAGES TIME
  //   
  // Defines type categories, based on sheet 'Types' of the google spreadsheet 
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
        this.resultsAll = app.Records.getResults();
//        this.graphView = new views.OverviewGraph();
//        this.scoreView = new views.OverviewScore();
        this.render();
        this.listenTo(this.model, 'change', this.render);
    },    
    render: function() {
      this.currentYear = parseInt(this.model.get('year'));
      this.currentYearData = app.Years.byYear(this.currentYear).first();
      this.currentCount = this.resultsAll[this.currentYear].count;
      this.resetFields();      
      this.collectionActive = null;
 
      // depending on report 
      // all entities
      if (this.model.get('report') === "entities" && this.model.get('id') === 'all') {        
        //prepare models for averages views
        this.modelAveragesTime = new models.AveragesTime({
          all: this.resultsAll
        });           
        // top
        this.fields.title = 'All entities';
        this.fields.subtitle = 'This report shows the average compliance of all Crown entities';
        // bottom
        this.fields.score = this.resultsAll[this.currentYear].percentage + '%';
        this.fields.rank_title = 'Number of Crown entities';
        this.fields.rank = this.currentCount;
        this.fields.summary = this.currentYearData.get('summaryoverview');        
      } 
      
      // individual entity
      else if (this.model.get('report') === "entity") {
        var entityID = parseInt(this.model.get('id'));
        var entityRecords = app.Records.byEntity(entityID);
        this.collectionActive = entityRecords.byYear(this.currentYear);
        var entity = this.collectionActive.first();
                
        var resultsType = app.Records.byType(entity.typeID).getResults();
        var resultsSize = app.Records.bySize(entity.getStaffNo()).getResults();
        
        //prepare models for averages views
        this.modelAverages = new models.Averages({
          all: this.resultsAll[this.currentYear].percentage,
          type:resultsType[this.currentYear].percentage,
          size:resultsSize[this.currentYear].percentage
        });
        
        this.modelAveragesTime = new models.AveragesTime({
          all: this.resultsAll,
          type:resultsType,
          size:resultsSize,
          entity:entityRecords.getResults()
        });        
        
        var scoreChange = entity.getScoreChange(true);
        if (scoreChange){
          if (scoreChange > 0) {scoreChange = '+' + scoreChange;}
          scoreChange = scoreChange + '%';
        } else {
          scoreChange = '';
        }
        var rankChange = entity.getRankChange();
        if (rankChange){
          if (rankChange > 0) {rankChange = '+' + rankChange;}
        } else {
          rankChange = '';
        } 
        
        // top
        this.fields.title = entity.get('title');
        this.fields.subtitle = entity.get('explanation');
        this.fields.type_label = 'Type';
        this.fields.type = entity.getTypeTitle();
        this.fields.size_label = 'Size';
        this.fields.size = entity.getStaffNo();
        // bottom
        this.fields.score = entity.getScore(true) + '%';
        this.fields.score_change = scoreChange;
        this.fields.rank_title = 'Rank';
        this.fields.rank = entity.getRank();
        this.fields.rank_of = ' of ' + this.currentCount + ' Crown entities';
        this.fields.rank_change = rankChange;
        this.fields.summary = entity.get('summary');        
      }
      
      // type or size category report
      else if (this.model.get('report') === "type" || this.model.get('report') === "size") {
        var cat, recordsCat, resultsCat;
        // type category report
        if (this.model.get('report') === "type") {          
          
          var typeID = this.model.get('id');
          cat = app.Types.findWhere({id:typeID});
          recordsCat = app.Records.byType(typeID);
          resultsCat = recordsCat.getResults(); 
          
          //prepare models for averages views
          this.modelAverages = new models.Averages({
            all: this.resultsAll[this.currentYear].percentage,
          });

          this.modelAveragesTime = new models.AveragesTime({
            all: this.resultsAll,
            type:resultsCat,
          }); 
        }     
        // size category report
        else if (this.model.get('report') === "size") {
          var sizeID = this.model.get('id');
          cat = app.Sizes.bySize(sizeID).first();
          recordsCat = app.Records.bySize(sizeID);
          resultsCat = recordsCat.getResults();
          
          //prepare models for averages views
          this.modelAverages = new models.Averages({
            all: this.resultsAll[this.currentYear].percentage,
          });

          this.modelAveragesTime = new models.AveragesTime({
            all: this.resultsAll,
            size:resultsCat,
          });           
        }
        
        this.collectionActive = recordsCat.byYear(this.currentYear);      
        
        // top
        this.fields.title = cat.get('title');
        // bottom
        this.fields.score = resultsCat[this.currentYear].percentage + '%';
        this.fields.rank_title = 'Number of ' + cat.get('title');
        this.fields.rank = recordsCat.byYear(this.currentYear).length;
        this.fields.rank_of = ' of ' + this.currentCount + ' Crown entities';
        this.fields.summary = this.currentYearData.get('summaryoverview');
      }
      
      
      this.$el.html(this.template(this.fields));
      
      this.graphView = new views.OverviewGraph({ 
        collection        : app.Records.byYear(this.currentYear).sortBy('score'),
        collectionActive  : this.collectionActive
      });
      // add the stub HTML required by Flot to hold the graph canvas
      $('#overview-graph').append( this.graphView.render().el );
      this.graphView.renderGraph();
      
      this.averagesView = new views.Averages({model:this.modelAverages});          
      
      
      this.averagesGraphView = new views.AveragesTimeGraph({model:this.modelAveragesTime});
      $('#overview-time-graph').append( this.averagesGraphView.render().el );
      this.averagesGraphView.renderGraph();
      
      return this;      
    },
    resetFields: function(){
      this.fields = {
        year : this.currentYear,
        title : '',
        subtitle : '',
        type_label : '',
        type : '',
        size_label : '',
        size : '',
        score_title : 'Overall compliance',
        score : '',
        score_change : '',
        rank_title : '',
        rank : '',
        rank_of : '',
        rank_change : '',
        summary : '',
      }
    },                

    toPDF : function (doc){
      
    },
template: _.template('\
<div id="overview-top">\n\
  <h2><%= title %></h2>\
  <h4><%= subtitle %></h4>\
  <h2><%= year %></h2>\n\
<% if (type !== "") {%>\n\
  <div><span class="label"><%= type_label %>: </span><%= type %></div>\n\
<% } %>\n\
<% if (size !== "") {%>\n\
  <div><span class="label"><%= size_label %>: </span><%= size %></div>\n\
<% } %>\n\
</div><!-- #overview-top -->\n\
<div id="overview-graph"></div><!-- #overview-graph -->\n\
<div id="overview-bottom">\n\
  <div class="accordion-top">\n\
    <div class="left">\n\
      <div class="score-panel">\n\
        <div class="score-label">\n\
          <%= score_title %>\n\
        </div>\n\
        <div class="score">\n\
          <%= score %>\n\
        </div>\n\
        <div class="score-change">\n\
          <%= score_change %>\n\
        </div>\n\
      </div>\n\
    </div>\n\
    <div class="right">\n\
      <div class="averages-panel"></div>\n\
    </div>\n\
  </div>\n\
  <div class="accordion-bottom">\n\
    <div class="left">\n\
      <div class="rank-panel">\n\
        <div class="rank-label">\n\
          <%= rank_title %>\n\
        </div>\n\
        <div class="rank">\n\
          <%= rank %><%= rank_of %>\n\
        </div>\n\
        <div class="rank-change">\n\
          <%= rank_change %>\n\
        </div>\n\
      </div>\n\
      <div class="summary-panel">\n\
        <%= summary %>\n\
      </div>\n\
    </div>\n\
    <div class="right">\n\
      <div id="overview-time-graph"></div><!-- #overview-time-graph -->\n\
    </div>\n\
  </div>\n\
</div><!-- #overview-bottom -->\
    '),      

  });              
  
  views.OverviewGraph = Backbone.View.extend({
    initialize : function (options) {
      this.options = options || {};
    },
    events : {
      "plotclick .plot" : "plotclick",
      "plothover .plot" : "plothover",
    },            
    attributes: { class: 'overview-graph' },
    plotOptions: {
      yaxis: {
        tickColor:'#000000',
        color:'#000000',
        min:0,
        max:100, 
        position:'right',
        ticks:[[0,'0%'],[25,''],[50,'50%'],[75,''],[100,'100%']],
        tickLength:10
      },
      xaxis: {
        show:false,
        min: -1
      },
      legend: { 
        show: true,
        container :'.legend-overview'
      },
      grid: { 
        hoverable: true, 
        clickable: true, 
        autoHighlight: true, 
        backgroundColor: '#ffffff',
        show: true,
        aboveData: true,
        margin: 0,
        labelMargin: 10,
        markings: [],
        borderWidth: {top:0,right:1,bottom:1,left:0},
        borderColor: '#000000',
        color: '#000000',
        minBorderMargin: 0,
      },
      series: {
        bars: { 
          show: true, 
          fill: 1, 
          barWidth: 0.8, 
          align: 'center',
          lineWidth: 0,          
        },
        highlightColor : '#ddd'
      },
    },

    render: function() {
      this.$el.html('<div class="plot"></div><div class="legend-overview"></div>');
      return this;
    },
            
    renderGraph: function() {

      var options = _.clone(this.plotOptions);
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
            
      options.xaxis.max = this.collection.length + 1;

      var dataset = [{ label : 'Entity Totals', data : data },{label : 'Selection', data : dataActive}];

      // Now, the chart can be drawn ...
      this.plot = $.plot( this.$('.plot'), dataset, options );

    },
    plotclick : function(event, pos, item){
      console.log('plotclick');
      // there must be a better way
      if ( item ) {        
        app.App.navigate(
            app.filter.get('year') 
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

        this.hoverTip = $(this.toolTipHTML( 
                item.series.data[item.dataIndex][1], 
                this.collection.models[item.dataIndex].get('title') ));

        this.$('.plot').parent().append(this.hoverTip);

        ofsh = this.hoverTip.outerHeight();
        ofsw = this.hoverTip.outerWidth();

        this.hoverTip.offset({
          left: item.pageX - ofsw / 2,
          top: item.pageY - ofsh - 5
        });
      }      
    },
    toolTipHTML :function( stat, series ) {

      var html = '';

      html += '<div class="tooltip">';
      html += '<div>';

      if ( series )
         html += '<span class="series">'+series+'</span>';

      html += '<span class="stats">'+stat+'%</span>';
      html += '</div>';
      html += '</div>';

      return html;

   }
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
  
  
  
  views.Averages = Backbone.View.extend({
  });

  views.AveragesTimeGraph = Backbone.View.extend({ 
    initialize : function (options) {
      this.options = options || {};
    },
    attributes: { class: 'time-graph'},

    plotOptions: {
      
      yaxis: {
        color:'#000000',
        min:0,
        max:100, 
        position:'right',
        ticks:[[0,'0%'],[25,''],[50,'50%'],[75,''],[100,'100%']],
        tickLength:10
      },
      xaxis: {
        color:'#000000',
        tickSize:1,
        tickDecimals:0,
        tickLength:0
      },
      legend: { 
        show: true
      },
      grid: { 
        hoverable: true, 
        clickable: true, 
        autoHighlight: true, 
        backgroundColor: '#ffffff',
        show: true,
        aboveData: true,
        margin: 0,
        labelMargin: 10,
        markings: [],
        borderWidth: {top:0,right:1,bottom:1,left:0},
        borderColor: '#000000',
        color: '#000000',
        minBorderMargin: 0,
      },      
      series: {
        shadowSize : 0,
        lines: { 
          show: true,
          
        }
      }
    },

    render: function() {
      this.$el.html('<div class="plot-wrapper-'+this.cid+'"><div class="plot"></div><div class="legend"></div></div>');
      return this;
    },
            
    renderGraph: function() {

      var options = _.clone(this.plotOptions);
      
      var data = [];
      var dataset = [];
      
      //all entities
      _.each(this.model.get('all'), function(year) { 
        data.push([year.year,year.percentage]);
      });
      dataset.push({label : this.model.get('all_label'),data:data});
      
      data = [];
      //if type
      if (!$.isEmptyObject(this.model.get('type'))){
        _.each(this.model.get('type'), function(year) { 
          data.push([year.year,year.percentage]);
        });
        dataset.push({label : this.model.get('type_label'),data:data});
      }
      data = [];
      //if size
      if (!$.isEmptyObject(this.model.get('size'))){
        _.each(this.model.get('size'), function(year) { 
          data.push([year.year,year.percentage]);
        });
        dataset.push({label : this.model.get('size_label'), data:data});
      }
      data = [];
      //if entity
      if (!$.isEmptyObject(this.model.get('entity'))){
        _.each(this.model.get('entity'), function(year) { 
          data.push([year.year,year.percentage]);
        });
        dataset.push({label : this.model.get('entity_label'), data:data});
      }
      options.legend.container = '.plot-wrapper-'+this.cid+' .legend';
      options.xaxis.max =  Math.max.apply(Math, Object.keys(this.model.get('all')))+(1/12);
      // Now, the chart can be drawn ...
      this.plot = $.plot( this.$('.plot'), dataset, options );      
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
        
        //default to all entities
        if ($.inArray(filter[0],['entities','entity','type','size']) === -1 || filter[1] === 'none' || filter[1] === '') {
          this.navigate(year + '/report/entities-all', {trigger: true});
        } else {
          app.filter.set({year:year,report:filter[0],id:filter[1]});
        }
        // load views if not already loaded
        app.viewsIntro    = app.viewsIntro     || new views.Intro({ el: $("#intro") });
        app.viewsTools    = app.viewsTools     || new views.Tools({ el: $("#tools"), model:app.filter });
        app.viewsOverview = app.viewsOverview  || new views.Overview({ el: $("#overview"), model:app.filter });

//        // Load the details view
//        app.viewsDetails && (app.viewsDetails.close ? app.viewsDetails.close() : app.viewsDetails.remove());      
//        app.viewsDetails = new views.Details({ el: $("#details") });
    
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

