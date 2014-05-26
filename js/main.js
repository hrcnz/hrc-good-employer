
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
      COLORS = {               
        dark          :{r:97,g:98,b:97},
        light         :{r:210,g:210,b:210},
        all           :{r:115,g:28,b:31}, // red
        all_light     :{r:210,g:164,b:166},        
        entity        :{r:36,g:173,b:162}, // turquoise
        entity_light  :{r:203,g:227,b:225},        
        type          :{r:163,g:185,b:64}, // green
        type_light    :{r:220,g:227,b:179},        
        size          :{r:36,g:98,b:132}, // blue
        size_light    :{r:185,g:195,b:212},
      };
  
  /*
   * DATA models & collections: representing the data loaded from spreadsheet
   */
  models.Config = Backbone.Model.extend({
    color : function(is_light,is_hex){
      is_light = typeof is_light !== 'undefined' ? is_light : false;
      is_hex = typeof is_hex !== 'undefined' ? is_hex : false;
      var report = this.get('report');
      var rgb;
      if (report === 'entities') {
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
  });
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
  models.Type = Backbone.Model.extend({
  });  
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
      return (this.get('staffno') !== '') ? this.get('staffno'): 'Not specified';
    },
    getTypeTitle : function(){
      return (this.typeID !== '') ? app.Types.findWhere({id : this.typeID}).get('title') : 'Not specified';      
    },
    getStaffTitle : function(){
      return (this.get('staffno') !== '') ? app.Sizes.bySize(this.get('staffno')).first().get('title') : 'Not specified';      
    }
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
  

  
  /*
   * VIEW-SPECIFIC models & collections: containing data as needed for views
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
  // AVERAGES
  //   
  // Defines type categories, based on sheet 'Types' of the google spreadsheet 
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
      legend:true
    },
  });     
    
  models.Overview = Backbone.Model.extend({
    initialize: function(){
      this.set('updated',0);
      this.set('resultsAll', app.Records.getResults());
      this.resetFields();
    },
    update : function(){
      this.currentYear = parseInt(app.Config.get('year'));
      this.currentYearData = app.Years.byYear(this.currentYear).first();     
      this.currentCount = this.get('resultsAll')[this.currentYear].count;
      
      this.set({
        year: this.currentYear,
        graphCollectionActive : null,
        graphCollection : app.Records.byYear(this.currentYear).sortBy('score')
      });            
      
      this.resetFields();
      
      // depending on report 
      // all entities
      if (app.Config.get('report') === "entities" && app.Config.get('id') === 'all') {                                   
        // top
        this.set({
          title: 'All entities',
          subtitle : 'This report shows the average compliance of all Crown entities',
        // bottom
          score : this.get('resultsAll')[this.currentYear].percentage + '%',
          rank_label : 'Number of Crown entities',
          rank : this.currentCount,
          summary : this.currentYearData.get('summaryoverview'),
          modelAverages : new models.Averages({}),
          modelAveragesTime : new models.AveragesTime({
            all: this.get('resultsAll')
          }),
        });
        
      } 
      
      // individual entity
      else if (app.Config.get('report') === "entity") {
        var entityID = parseInt(app.Config.get('id'));
        var entityRecords = app.Records.byEntity(entityID);
        var entitiesByYear = entityRecords.byYear(this.currentYear);
        if (entitiesByYear.length === 0) {
          
        } else {
          this.set('graphCollectionActive', entitiesByYear);
          var entity = this.get('graphCollectionActive').first();

          var resultsType = app.Records.byType(entity.typeID).getResults();
          var resultsSize = app.Records.bySize(entity.getStaffNo()).getResults();

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
              size_label  : 'Same Size: ' + entity.getStaffTitle(), 
              entity_label: entity.get('title'),        
            })
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
          this.set({
            title : entity.get('title'),
            subtitle : entity.get('explanation'),          
            type_label : 'Type',
            type : entity.getTypeTitle(),
            size_label : 'Size',
            size : entity.getStaffNo(),
            // bottom
            score : entity.getScore(true) + '%',
            score_diff : scoreChange,
            rank_label : 'Rank',
            rank : entity.getRank(),
            rank_of : ' of ' + this.currentCount + ' Crown entities',
            rank_diff : rankChange,
            summary : entity.get('summaryoverview')
          });
        }
      }
      
      // type or size category report
      else if (app.Config.get('report') === "type" || app.Config.get('report') === "size") {
        var cat, recordsCat, resultsCat;
        // type category report
        if (app.Config.get('report') === "type") {          
          
          var typeID = app.Config.get('id');
          cat = app.Types.findWhere({id:typeID});
          recordsCat = app.Records.byType(typeID);
          resultsCat = recordsCat.getResults(); 
          //prepare models for averages views
          this.set({
            title : 'Type: '+cat.get('title'),
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
        else if (app.Config.get('report') === "size") {
          var sizeID = app.Config.get('id');
          cat = app.Sizes.bySize(sizeID).first();
          recordsCat = app.Records.bySize(sizeID);
          resultsCat = recordsCat.getResults();
          
          //prepare models for averages views
          this.set({
            title : 'Staff size: '+cat.get('title'),            
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
          // bottom
          score : resultsCat[this.currentYear].percentage + '%',
          rank_label : 'Number of ' + cat.get('title'),
          rank : recordsCat.byYear(this.currentYear).length,
          rank_of : ' of ' + this.currentCount + ' Crown entities',
          summary : this.currentYearData.get('summaryoverview'),
        });
        
      }      
      
      // triggers the view rendering
      this.set('updated',app.Config.get('id')+app.Config.get('year'));
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
        score_diff : '',
        rank_label : '',
        rank : '',
        rank_of : '',
        rank_diff : '',
        summary : '',
      })
    },
            
  });  

  models.Details = Backbone.Model.extend({
    initialize: function(){
      var that = this;
      this.set('updated',0);
      this.results = {};
      this.results.all = app.Records.getResults();
      this.results.all_geref = app.Records.getResults({criterion:'geref'});
      this.results.all_ge = app.Records.getResults({group:'GE'});
      this.results.all_ge_elements = [];
      _.each(app.Criteria.byGroup('GE').models, function(criterion){
        that.results.all_ge_elements.push(app.Records.getResults({criterion:criterion.get('id')}));
      });
      this.results.all_wp = app.Records.getResults({group:'WP'});
      this.results.all_wp_elements = [];
      _.each(app.Criteria.byGroup('WP').models, function(criterion){
        that.results.all_wp_elements.push(app.Records.getResults({criterion:criterion.get('id')}));
      });
      this.results.all_eeoref = app.Records.getResults({criterion:'eeoref'});
      this.results.all_review = app.Records.getResults({criterion:'review'});
      this.results.all_participation = app.Records.getResults({criterion:'participation'});
      this.resetFields();
    },
    update : function(){
      this.currentYear = parseInt(app.Config.get('year'));
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
      
      if (app.Config.get('report') === "entity") {                                   
        var entityID = parseInt(app.Config.get('id'));
        var entityRecords = app.Records.byEntity(entityID);        
        var entitiesByYear = entityRecords.byYear(this.currentYear);
        if (entitiesByYear.length === 0) {
          
        } else {      
          var entity = entitiesByYear.first();
          typeRecords = app.Records.byType(entity.typeID);
          sizeRecords = app.Records.bySize(entity.getStaffNo());
          results.geref.entity = entityRecords.getResults({criterion:'geref'});
          results.ge.entity = entityRecords.getResults({group:'GE'});
          results.wp.entity = entityRecords.getResults({group:'WP'});
          results.eeoref.entity = entityRecords.getResults({criterion:'eeoref'});
          results.review.entity = entityRecords.getResults({criterion:'review'});
          results.participation.entity = entityRecords.getResults({criterion:'participation'});
        }
      }                              
      else if (app.Config.get('report') === "type") {          
        var typeID = app.Config.get('id');        
        typeRecords = app.Records.byType(typeID);        
      } 
      // size category report
      else if (app.Config.get('report') === "size") {
        var sizeID = app.Config.get('id');        
        sizeRecords = app.Records.bySize(sizeID);        
      }
      
      results.geref.all = this.results.all_geref;
      results.ge.all = this.results.all_ge;
      results.wp.all = this.results.all_wp;
      results.eeoref.all = this.results.all_eeoref;
      results.review.all = this.results.all_review;
      results.participation.all = this.results.all_participation;          
      
      if (typeof typeRecords !== 'undefined'){
        results.geref.type = typeRecords.getResults({criterion:'geref'});
        results.ge.type = typeRecords.getResults({group:'GE'});
        results.wp.type = typeRecords.getResults({group:'WP'});
        results.eeoref.type = typeRecords.getResults({criterion:'eeoref'});
        results.review.type = typeRecords.getResults({criterion:'review'});
        results.participation.type = typeRecords.getResults({criterion:'participation'});
      }
      if (typeof sizeRecords !== 'undefined'){
        results.geref.size = sizeRecords.getResults({criterion:'geref'});
        results.ge.size = sizeRecords.getResults({group:'GE'});     
        results.wp.size = sizeRecords.getResults({group:'WP'});     
        results.eeoref.size = sizeRecords.getResults({criterion:'eeoref'});
        results.review.size = sizeRecords.getResults({criterion:'review'});
        results.participation.size = sizeRecords.getResults({criterion:'participation'});
      }
      this.set({
          year: this.currentYear,          
          subviews : {
            geref : new models.CriteriaDetails({
              criteria : 'single',
              year : this.currentYear,
              id : 'geref',
              report : app.Config.get('report'),
              results : results.geref,
              title : app.Criteria.findWhere({id:'ge_ref'}).get('title').trim(),
              summary : this.currentYearData.get('summarygeref'),
            }),
            ge : new models.CriteriaDetails({
              criteria : 'group',
              year : this.currentYear,
              id : 'ge',
              report : app.Config.get('report'),
              results : results.ge,
              title : app.CriteriaGroups.findWhere({id:'GE'}).get('title').trim(),
              summary : this.currentYearData.get('summarygeelements'),
            }),            
            eeoref : new models.CriteriaDetails({
              criteria : 'single',
              year : this.currentYear,
              id : 'geref',
              report : app.Config.get('report'),
              results : results.eeoref,
              title : app.Criteria.findWhere({id:'eeo_ref'}).get('title').trim(),
              summary : this.currentYearData.get('summaryeeoref'),
            }),
            review : new models.CriteriaDetails({
              criteria : 'single',
              year : this.currentYear,
              id : 'review',
              report : app.Config.get('report'),
              results : results.review,
              title : app.Criteria.findWhere({id:'review'}).get('title').trim(),
              summary : this.currentYearData.get('summaryreview'),
            }),
            wp : new models.CriteriaDetails({
              criteria : 'group',
              year : this.currentYear,
              id : 'wp',
              report : app.Config.get('report'),
              results : results.wp,
              title : app.CriteriaGroups.findWhere({id:'WP'}).get('title').trim(),
              summary : this.currentYearData.get('summarywp'),
            }),            
            participation : new models.CriteriaDetails({
              criteria : 'single',
              year : this.currentYear,
              id : 'participation',
              report : app.Config.get('report'),
              results : results.geref,
              title : app.Criteria.findWhere({id:'participation'}).get('title').trim(),
              summary : this.currentYearData.get('summaryparticipation'),
            }),
          }
        });
      
      // triggers the view rendering
      this.set('updated',app.Config.get('id')+app.Config.get('year'));      
    },
    resetFields : function(){
      this.set({
        subviews : {}
      });
    },
  });
  models.CriteriaDetails = Backbone.Model.extend({
    initialize : function(){  
      var results = this.get('results');
      var currentYear = this.get('year');      
      if (this.get('report') === 'entities') { 
        this.set('score',results.all[currentYear].percentage + '%');
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
        this.set('score',results.entity[currentYear].percentage + '%');
        this.set('modelAverages', 
          new models.Averages({
            all: results.all[currentYear].percentage,    
            type:results.type[currentYear].percentage,
            size:results.size[currentYear].percentage
          })
        );
        this.set('modelAveragesTime' , 
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
        this.set('score',results.type[currentYear].percentage + '%');
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
        this.set('score',results.type[currentYear].percentage + '%');
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
      var variables = {
        entities        : app.Records.byYear(parseInt(this.model.get('year'))).models,
        types           : app.Types.models,
        sizes           : app.Sizes.models,
        years           : (this.model.get('report') === "entity") 
? app.Years.active().byYears(Object.keys(app.Records.byEntity(parseInt(this.model.get('id'))).getResults())).models
: app.Years.active().models,        
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
      "click #renderPdf": "renderPdf",
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
    renderPdf: function( event ){
        event.preventDefault();
        renderPdf();
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
<a href="#" id="renderPdf">Download report as pdf</a>\
    ')                
  });
  
  /*
   * views.Intro
   */ 
  views.Intro = Backbone.View.extend({
    initialize: function () {
        this.render();
    },
    render: function(){
      this.$el.html(this.template(this.model));
      return this;      
    },
    template: _.template('<h1><%= title %></h1>\n\
<h3><%= subtitle %></h3>\n\
<p><%= summary %></p>'),
    renderPdf: function (writer,attr){
      console.log('intro.renderpdf');

      writer.addText(this.model.title,'intro_title');
      writer.addText(this.model.subtitle,'intro_subtitle');     
      writer.addText(this.model.summary,'intro_summary');     
      writer.addLine('intro_line');
      writer.addImage('intro_logo','intro_logo')

    },            
  });

 /* 
  * views.Overview
  */
  views.Overview = Backbone.View.extend({
    initialize: function () {
        this.subviews = {};
        this.render();
        this.listenTo(this.model, 'change:updated', this.render);        
    },    
    render: function() {
      
      this.$el.html(this.template(this.model.attributes));
      
      
      // subview overview graph
      this.subviews.graphView = new views.OverviewGraph({ 
        collection        : this.model.get('graphCollection'),
        collectionActive  : this.model.get('graphCollectionActive'),
      });
      $('#overview-graph').append( this.subviews.graphView.render().el );
      this.subviews.graphView.renderGraph();
      
      // subview averages 
      this.subviews.averagesView = new views.Averages({model:this.model.get('modelAverages')});
      $('.averages-panel').append( this.subviews.averagesView.render().el );      
      
      // subview averages time graph
      this.subviews.averagesGraphView = new views.AveragesTimeGraph({model:this.model.get('modelAveragesTime')});
      $('#overview-time-graph').append( this.subviews.averagesGraphView.render().el );
      this.subviews.averagesGraphView.renderGraph();
      
      return this;      
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
          <%= score_label %>\n\
        </div>\n\
        <div class="score">\n\
          <%= score %>\n\
        </div>\n\
        <div class="score-change">\n\
          <%= score_diff %>\n\
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
          <%= rank_label %>\n\
        </div>\n\
        <div class="rank">\n\
          <%= rank %><%= rank_of %>\n\
        </div>\n\
        <div class="rank-change">\n\
          <%= rank_diff %>\n\
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
    renderPdf: function (writer,attr){
      var highlight = app.Config.color();
      
      console.log('overview.renderpdf');

      writer.addText(this.model.get('title'),'overview_title');
      writer.addText(this.model.get('subtitle'),'overview_subtitle',{color : COLORS.light});     
      writer.addText(this.model.get('year').toString(),'overview_year',{color : highlight});
      writer.addText(this.model.get('type_label'),'overview_type_label');
      writer.addText(this.model.get('type'),'overview_type');
      writer.addText(this.model.get('size_label'),'overview_size_label');
      writer.addText(this.model.get('size').toString(),'overview_size');
      writer.addText(this.model.get('score_label'),'overview_score_label');
      writer.addText(this.model.get('score').toString(),'overview_score',{color : highlight});
      writer.addText(this.model.get('score_diff'),'overview_score_diff',{color : highlight});
      writer.addLine('overview_score_line');
      writer.addText(this.model.get('rank_label'),'overview_rank_label');
      writer.addText(this.model.get('rank').toString(),'overview_rank',{color : highlight});
      writer.addText(this.model.get('rank_of'),'overview_rank_of',{color : highlight});
      writer.addText(this.model.get('rank_diff').toString(),'overview_rank_diff',{color : highlight});
      writer.addLine('overview_rank_line');
      writer.addText(this.model.get('summary'),'overview_summary');            
      
      //print subviews
      this.subviews.graphView.renderPdf(writer);
      this.subviews.averagesGraphView.renderPdf(writer,'overview_averages_graph');
      this.subviews.averagesView.renderPdf(writer,'overview_averages');

    },             
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
      canvas: true,
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
        show: false,
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
          barWidth: 0.9, 
          align: 'center',
          lineWidth: 0,          
        },
      },
    },

    render: function() {
      this.$el.html('<div class="plot"></div><div class="legend-overview"></div>');
      return this;
    },
            
    renderGraph: function() {

      var options = _.clone(this.plotOptions);
      options.series.highlightColor = rgbToHex(COLORS.all);//app.Config.color(false,true);
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

      var dataset = [{ data : data, bars : {fillColor:app.Config.color(true,true)} },{ data : dataActive, bars : {fillColor:app.Config.color(false,true)}}];

      // Now, the chart can be drawn ...
      this.plot = $.plot( this.$('.plot'), dataset, options );

    },
    
    renderPdf: function(writer){
        writer.addPlot(this.plot.getCanvas(),'overview_graph');
    },    
    plotclick : function(event, pos, item){
      console.log('plotclick');
      event.preventDefault();
      // there must be a better way
      if ( item ) {        
        app.App.navigate(
            app.Config.get('year') 
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

      html += '<span class="stats">Compliance: '+stat+'%</span>';
      html += '</div>';
      html += '</div>';

      return html;

   }
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
      var label_margin = {top:3,right:15};
      
      // add subview title
      offset.y += writer.addText(this.model.get('title'),item_key);
      
      // get item to calculate offsets
      var item = writer.item(item_key,attr);           
      
      if(this.model.get('type')){
        writer.addText(this.model.get('type_label'),'default',{x:item.x+offset.x,y:item.y+offset.y + label_margin.top});
        writer.addText(this.model.get('type')+'%','default',{x:item.x+offset.x + label_margin.right,y:item.y+offset.y + label_margin.top,style:'bold',color:COLORS.type});
        offset.x += writer.addAverageBar(this.model.get('type'),{x:item.x+offset.x,y:item.y+offset.y,color:COLORS.type});        
      }
      if(this.model.get('size')){
        writer.addText(this.model.get('size_label'),'default',{x:item.x+offset.x,y:item.y+offset.y + label_margin.top});
        writer.addText(this.model.get('size')+'%','default',{x:item.x+offset.x + label_margin.right,y:item.y+offset.y + label_margin.top,style:'bold',color:COLORS.size});        
        offset.x += writer.addAverageBar(this.model.get('size'),{x:item.x+offset.x,y:item.y+offset.y,color:COLORS.size});
      }
      if(this.model.get('all')){
        writer.addText(this.model.get('all_label'),'default',{x:item.x+offset.x,y:item.y+offset.y + label_margin.top});
        writer.addText(this.model.get('all')+'%','default',{x:item.x+offset.x + label_margin.right,y:item.y+offset.y + label_margin.top,style:'bold',color:COLORS.all});        
        offset.x += writer.addAverageBar(this.model.get('all'),{x:item.x+offset.x,y:item.y+offset.y,color:COLORS.all});
      }
      offset.y += 10;
      
      writer.addLine('half_line',{y:item.y+offset.y});
    },
    template: _.template('\
    <div class="averages">\
      <div class="averages-title"><h4><%=title%></h4></div>\
      <% if (type > -1) {%>\
      <div class="average-type" style="background:#ddd;position:relative;width:100px;display:block;height:10px">\
        <span style="width:<%=type%>%;position:absolute;left:0;height:10px;background:<%=type_color%>;display:block"></span>\
      </div>\
      <div><%=type_label%> <%=type%>%</div>\
      <% }%>\
      <% if (size > -1) {%>\
      <div class="average-size" style="background:#ddd;position:relative;width:100px;display:block;height:10px">\
        <span style="width:<%=size%>%;position:absolute;left:0;height:10px;background:<%=size_color%>;display:block"></span>\
      </div>\
      <div><%=size_label%> <%=size%>%</div>\
      <% }%>\
      <% if (all > -1) {%>\
      <div class="average-all" style="background:#ddd;position:relative;width:100px;display:block;height:10px">\
        <span style="width:<%=all%>%;position:absolute;left:0;height:10px;background:<%=all_color%>;display:block"></span>\
      </div>\
      <div><%=all_label%> <%=all%>%</div>\
      <% }%>\
    </div>\
    ')            
  });

  views.AveragesTimeGraph = Backbone.View.extend({ 
    initialize : function (options) {
      this.options = options || {};
    },
    attributes: { class: 'time-graph'},

    plotOptions: {
      canvas: true,
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
        show: false
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
      }
    },

    render: function() {
      this.$el.html('<div class="plot-wrapper-'+this.cid+'"><div class="plot"></div><div class="legend"></div></div>');
      return this;
    },
    lineOptions:function(report,options){
      if (report === 'all') { 
        if(app.Config.get('report') === 'entities') {
          return $.extend(options,{lines:{show:true,lineWidth:2}});
        } else {
          return $.extend(options,{dashes:{show:true,lineWidth:1.5,dashLength:2}});
        }
      }
      else if (report === 'type') { 
        if(app.Config.get('report') === 'type') {
          return $.extend(options,{lines:{show:true,lineWidth:2}});
        } else {
          return $.extend(options,{dashes:{show:true,lineWidth:1.5,dashLength:5}});
        }
      }
      else if (report === 'size') { 
        if(app.Config.get('report') === 'size') {
          return $.extend(options,{lines:{show:true,lineWidth:2}});
        } else {
          return $.extend(options,{dashes:{show:true,lineWidth:1.5,dashLength:10}});
        }
      }
      
    },       
    renderGraph: function() {

      var options = _.clone(this.plotOptions);
      
      var data = [];
      var dataset = [];
      options.colors = [];      
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
        dataset.push(this.lineOptions('size',{
          data  : data
        }));
        options.colors.push(rgbToHex(COLORS.size));

      }
      data = [];
      //if entity
      if (!$.isEmptyObject(this.model.get('entity'))){
        _.each(this.model.get('entity'), function(year) { 
          data.push([year.year,year.percentage]);
        });
        dataset.push({data:data});
        options.colors.push(rgbToHex(COLORS.entity));
      }
      options.xaxis.max =  Math.max.apply(Math, Object.keys(this.model.get('all')))+(1/12);
      // Now, the chart can be drawn ...
      this.plot = $.plot( this.$('.plot'), dataset, options ); 
      
      if (this.model.get('legend')) {
        $('.plot-wrapper-'+this.cid+' .legend').html(this.template($.extend(this.model.attributes,{report:app.Config.get('report')})));
      }      
    },
    renderPdf: function(writer,item_key,attr){
        writer.addPlot(this.plot.getCanvas(),item_key,attr);
    },
    template: _.template('\
    <ul class="legend">\
<% if (!$.isEmptyObject(entity)){%>\
<li class="legend-entity <% if (report === "entity"){%>legend-main<% } %>">\n\
<span class="line"></span>\n\
<span class="label"><%=entity_label%></span>\n\
</li>\
<% }%>\
<% if (!$.isEmptyObject(type)){%>\
<li class="legend-type <% if (report === "type"){%>legend-main<% } %>">\n\
<span class="line"></span>\n\
<span class="label"><%=type_label%></span>\n\
</li>\
<% }%>\
<% if (!$.isEmptyObject(size)){%>\
<li class="legend-size <% if (report === "size"){%>legend-main<% } %>">\n\
<span class="line"></span>\n\
<span class="label"><%=size_label%></span>\n\
</li>\
<% }%>\
<li class="legend-all <% if (report === "entities"){%>legend-main<% } %>">\n\
<span class="line"></span>\n\
<span class="label"><%=all_label%></span>\n\
</li>\
    </ul>\
    ')            
  });
    
  views.Details = Backbone.View.extend({
    initialize: function () {
        this.subviews = [];
        this.render();        
        this.listenTo(this.model, 'change:updated', this.render);        
    },
    render: function() {
      this.$el.html(this.template(this.model.attributes));
      var that = this;
      //subviews
      _.each(this.model.get('subviews'), function(sub){
        var subview = (sub.get('criteria') === 'single' )
           ? new views.Criterion({model:sub})
           : new views.Criterion({model:sub});
        that.subviews.push(subview);
        that.$el.append(subview.render().el);
        subview.renderGraphs();
      })
      return this;
    },
template: _.template(''),        
  }); 
  
  views.Criterion = Backbone.View.extend({
    initialize: function () {
        this.subviews = {};
    },    
    render: function() {
      
      this.$el.html(this.template(this.model.attributes));
      
      // subview averages 
      this.subviews.averagesView = new views.Averages({model:this.model.get('modelAverages')});
      this.$('.averages-panel').append( this.subviews.averagesView.render().el );                 
      
      // subview averages time graph
      this.subviews.averagesGraphView = new views.AveragesTimeGraph({model:this.model.get('modelAveragesTime')});            
      this.$('.criteria-time-graph').append( this.subviews.averagesGraphView.render().el );
      //this.subviews.averagesGraphView.renderGraph();
      return this;
    },
    renderGraphs : function (){
      this.subviews.averagesGraphView.renderGraph();
    },
    template : _.template('\
  <div class="criteria">\n\
  <div class="accordion-top">\n\
    <div class="left">\n\
      <div class="score">\n\
        <%= score %>\n\
      </div>\n\
      <div class="title"><%= title %></div>\n\
  </div>\n\
    <div class="right">\n\
      <div class="averages-panel"></div>\n\
    </div>\n\
  </div>\n\
  <div class="accordion-bottom">\n\
    <div class="left">\n\
      <div class="summary-panel"><%= summary %></div>\n\
    </div>\n\
    <div class="right">\n\
      <div class="criteria-time-graph"></div><!-- #overview-time-graph -->\n\
    </div>\n\
  </div>\n\
  </div>\n\
'),            
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
        app.Config    = app.Config || new models.Config();
        app.Overview  = app.Overview || new models.Overview();
        app.Details   = app.Details || new models.Details();
        //default to all entities
        if ($.inArray(filter[0],['entities','entity','type','size']) === -1 || filter[1] === 'none' || filter[1] === '') {
          this.navigate(year + '/report/entities-all', {trigger: true});
        } else {
          app.Config.set({year:year,report:filter[0],id:filter[1]});
        }
        // updating models >>> trigger view render
        app.Overview.update();
        app.Details.update();
        
        // load views if not already loaded
        app.viewsIntro    = app.viewsIntro     || new views.Intro({ el: $("#intro"), model:new models.Intro() });
        app.viewsTools    = app.viewsTools     || new views.Tools({ el: $("#tools"), model:app.Config });                
        app.viewsOverview = app.viewsOverview  || new views.Overview({ el: $("#overview"), model: app.Overview});
        app.viewsDetails  = app.viewsDetails   || new views.Details({ el: $("#details"), model: app.Details});
  
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

  
  function renderPdf() {   
      
      app.doc_writer = new models.DocWriter ();
      
      app.viewsIntro.renderPdf(app.doc_writer);      
      app.viewsOverview.renderPdf(app.doc_writer);
      //app.viewsDetails.renderPdf(doc_writer);
      
      app.doc_writer.output();

  } 
  
  models.DocWriter = Backbone.Model.extend({
    initialize : function(){
      this.doc = new jsPDF({lineHeight:this.defaults.lineHeight});           
      this.doc.setFontSize(this.defaults.elements.default.size);
    },     
    defaults : {
      lineHeight:1.4,
      offsets  :{
        averages : {single:28,group:100},      
        criteria : {
          geref:{p:1,y:0,x:0},
          eeoref:{p:1,y:0,x:110},
          GE:{p:2,y:0,x:0},
          WP:{p:2,y:0,x:110},          
          review:{p:2,y:200,x:0},
          participation:{p:200,y:0,x:110},
        }
      },
      elements  : { 
        default               : {y:15,x:15,w:180,h:0,size:8,style:'normal',margin:{top:0,bottom:2,right:0,left:0},color:COLORS.dark},        
        intro_title           : {y:15,size:17,style:'bold'},
        intro_subtitle        : {y:24,size:10,style:'bold'},
        intro_summary         : {y:32,w:130},
        intro_logo            : {y:13,x:163,w:32,h:35},
        intro_line            : {y:54,h:0.75,color:COLORS.dark},
        //----------------
        //----------------
        overview_title        : {y:63,w:130,size:16},
        overview_subtitle     : {y:73,w:130},
        overview_year         : {y:63,x:169,size:27,style:'bold'},
        overview_type_label   : {y:80,x:15,style:'bold'},
        overview_type         : {y:80,x:23},
        overview_size_label   : {y:84,x:15,style:'bold'},
        overview_size         : {y:84,x:23},
        //----------------
        overview_score_label  : {y:97,size:10,style:'bold'},
        overview_score        : {y:103,size:40,style:'bold'},
        overview_score_trend  : {y:103,x:53},
        overview_score_diff   : {y:112,x:53},
        overview_score_line   : {y:119,w:44,h:0.75,color:COLORS.light},
        //----------------
        overview_rank_label   : {y:124,style:'bold'},
        overview_rank         : {y:128,size:23,style:'bold'},
        overview_rank_of      : {y:128,x:25},
        overview_rank_trend   : {y:124,x:53},
        overview_rank_diff    : {y:133,x:53},
        overview_rank_line    : {y:139,w:44,h:0.75,color:COLORS.light},
        //----------------
        overview_graph        : {y:97,x:63,w:132,h:40},        
        overview_averages_graph:{y:145,x:110,w:85,h:30},
        averages_graph        : {w:85,h:30},
        overview_averages     : {y:145,w:85,style:'bold'},
        overview_summary      : {y:168,w:85},
        //----------------
        average_line          : {w:22,h:5,margin:{right:5},color:COLORS.light},        
        half_line             : {w:85,h:0.75,color:COLORS.light},
      },
      images : {
        intro_logo : {
          data:'data:image/jpeg;base64,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dAAAAAAAAAAAAAAAAFJzbHRVbnRGI1JsdEDqygAAAAAAAAAACnZlY3RvckRhdGFib29sAQAAAABQZ1BzZW51bQAAAABQZ1BzAAAAAFBnUEMAAAAATGVmdFVudEYjUmx0AAAAAAAAAAAAAAAAVG9wIFVudEYjUmx0AAAAAAAAAAAAAAAAU2NsIFVudEYjUHJjQFkAAAAAAAAAAAAQY3JvcFdoZW5QcmludGluZ2Jvb2wAAAAADmNyb3BSZWN0Qm90dG9tbG9uZwAAAAAAAAAMY3JvcFJlY3RMZWZ0bG9uZwAAAAAAAAANY3JvcFJlY3RSaWdodGxvbmcAAAAAAAAAC2Nyb3BSZWN0VG9wbG9uZwAAAAAAOEJJTQPtAAAAAAAQAvoAAAACAAIC+gAAAAIAAjhCSU0EJgAAAAAADgAAAAAAAAAAAAA/gAAAOEJJTQPyAAAAAAAKAAD///////8AADhCSU0EDQAAAAAABAAAAHg4QklNBBkAAAAAAAQAAAAeOEJJTQPzAAAAAAAJAAAAAAAAAAABADhCSU0nEAAAAAAACgABAAAAAAAAAAI4QklNA/UAAAAAAEgAL2ZmAAEAbGZmAAYAAAAAAAEAL2ZmAAEAoZmaAAYAAAAAAAEAMgAAAAEAWgAAAAYAAAAAAAEANQAAAAEALQAAAAYAAAAAAAE4QklNA/gAAAAAAHAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAOEJJTQQAAAAAAAACAAE4QklNBAIAAAAAAAQAAAAAOEJJTQQwAAAAAAACAQE4QklNBC0AAAAAAAYAAQAAAAM4QklNBAgAAAAAABAAAAABAAACQAAAAkAAAAAAOEJJTQQeAAAAAAAEAAAAADhCSU0EGgAAAAADVQAAAAYAAAAAAAAAAAAABBoAAAPAAAAAEABIAFIAQwAtAGwAbwBnAG8ALQAzADIAeAAzADUAbQBtAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAPAAAAEGgAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAABAAAAABAAAAAAAAbnVs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eGFwLzEuMC8APD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS41LWMwMjEgNzkuMTU0OTExLCAyMDEzLzEwLzI5LTExOjQ3OjE2ICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENDIChNYWNpbnRvc2gpIiB4bXA6Q3JlYXRlRGF0ZT0iMjAxNC0wNS0yNFQxNDo1MDo0NiswMjowMCIgeG1wOk1ldGFkYXRhRGF0ZT0iMjAxNC0wNS0yNFQxNDo1NDo1NCswMjowMCIgeG1wOk1vZGlmeURhdGU9IjIwMTQtMDUtMjRUMTQ6NTQ6NTQrMDI6MDAiIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHBob3Rvc2hvcDpJQ0NQcm9maWxlPSJzUkdCIElFQzYxOTY2LTIuMSIgZGM6Zm9ybWF0PSJpbWFnZS9qcGVnIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOmMzZWI2ZTVjLTkyMTYtNDAzZC05ZWM1LTE4NTI0NDhjZDBlNCIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo2M2YyOTllOC0xMDE5LTQ2ODEtOThmMi00OTYzMzJhMGU4NTMiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDo2M2YyOTllOC0xMDE5LTQ2ODEtOThmMi00OTYzMzJhMGU4NTMiPiA8cGhvdG9zaG9wOkRvY3VtZW50QW5jZXN0b3JzPiA8cmRmOkJhZz4gPHJkZjpsaT54bXAuZGlkOjc2RDdFNzFGQ0QyMDY4MTFBQ0FGRDUwNkExRjk0MENBPC9yZGY6bGk+IDwvcmRmOkJhZz4gPC9waG90b3Nob3A6RG9jdW1lbnRBbmNlc3RvcnM+IDx4bXBNTTpIaXN0b3J5PiA8cmRmOlNlcT4gPHJkZjpsaSBzdEV2dDphY3Rpb249ImNyZWF0ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6NjNmMjk5ZTgtMTAxOS00NjgxLTk4ZjItNDk2MzMyYTBlODUzIiBzdEV2dDp3aGVuPSIyMDE0LTA1LTI0VDE0OjUwOjQ2KzAyOjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgKE1hY2ludG9zaCkiLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjEzMDYyNmU3LWY1ZmUtNDNlOC1hNzNlLTRiODgxYzI5MWFhYiIgc3RFdnQ6d2hlbj0iMjAxNC0wNS0yNFQxNDo1NDo1NCswMjowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIChNYWNpbnRvc2gpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjb252ZXJ0ZWQiIHN0RXZ0OnBhcmFtZXRlcnM9ImZyb20gYXBwbGljYXRpb24vdm5kLmFkb2JlLnBob3Rvc2hvcCB0byBpbWFnZS9qcGVnIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJkZXJpdmVkIiBzdEV2dDpwYXJhbWV0ZXJzPSJjb252ZXJ0ZWQgZnJvbSBhcHBsaWNhdGlvbi92bmQuYWRvYmUucGhvdG9zaG9wIHRvIGltYWdlL2pwZWciLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOmMzZWI2ZTVjLTkyMTYtNDAzZC05ZWM1LTE4NTI0NDhjZDBlNCIgc3RFdnQ6d2hlbj0iMjAxNC0wNS0yNFQxNDo1NDo1NCswMjowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIChNYWNpbnRvc2gpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDwvcmRmOlNlcT4gPC94bXBNTTpIaXN0b3J5PiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDoxMzA2MjZlNy1mNWZlLTQzZTgtYTczZS00Yjg4MWMyOTFhYWIiIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6NjNmMjk5ZTgtMTAxOS00NjgxLTk4ZjItNDk2MzMyYTBlODUzIiBzdFJlZjpvcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6NjNmMjk5ZTgtMTAxOS00NjgxLTk4ZjItNDk2MzMyYTBlODUzIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw/eHBhY2tldCBlbmQ9InciPz7/4gxYSUNDX1BST0ZJTEUAAQEAAAxITGlubwIQAABtbnRyUkdCIFhZWiAHzgACAAkABgAxAABhY3NwTVNGVAAAAABJRUMgc1JHQgAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLUhQICAAAAAAAAAAAAAA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VdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVf/9D7+Yq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FX//R+/mKuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV//0vv5irsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVf/9P7+Yq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq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uxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV//0fv5irsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVf/9L7+Yq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FX//T+/mKuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV//1Pv5irsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVf/9X7+Yq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FX//W+/mKuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxVA6nqVjo2nX+r6ncpZabplvJd6heSV4RQwqXkdqV2VQScBIAstuDBPPkjjxi5SIAHeTsA+KvNX/OZjXdpqtx+TH5VeYvzLsNHhlmv/ADW9rPaaTGkIJkdXEbyOFUVNQh/Xmvnr7B8OJlXXo+q9nf8AAuEJwj2pq8WmlMgDHxCWQk8hzAF/5zzP/nHH/nL380vzl/ObSfJ+u6boOn+W76zv57i30+2mWVPq8DSRkSyzyH7QAO1DXKdJrsmbKImqd97cf8DTszsHseepwyySyxlEAyIr1EA7CI6P0vzbvg7sVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVfKfnr/nK7yvoeval5K/L/wAp6/8Amz540qd7TUdI0K0k+r2k8bFGjuLkoaFWFDxRgDUEg5hZNbGJ4YgyPk+idkf8DrU6jBHVa3Nj0mCQsSySHFIHe4xvqO8j3Pjm5/5zq/O2+/MLS/KA8m6H5QZtct9K1LR7q3uZ72J3uFhkileSWMBhUjaMZgHtLKZiNAbvp2P/AIEXYuPs+ep8fJm/dmYkDERPpMgQADt/nF+uWbx+bXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FX//1/v5irsVdirsVdirsVdirsVdir55/wCco/zF1H8tfyb8xatoNxNb+aNZkg0TytJbCs4vb5uIaEAEl0jV2WgrUZi6zKceIkczsHtf+B92Jj7W7YxY8wBxQByTvlwQ7/Imgfe+I/KH5V/858eabW3vbz8yNQ8n29wodE1zV5EnCn+aC3jndT7OAc12PDq5fxV7y+r9p+0PsJo5GEdNHMR/qeMEf6aRiD8LeqQf846/85fMqm5/5ydeFv2ljmvZAPkSiV+7LxpdT/qjz0/bf2SH09lX7xAfpL5C/O/z1/zkT+SfniTyNqH57a35gvIbG3vZ7y1uJYkX6wGKx8XJNQAD9OYOoyZsM+EzJfS/ZPsj2f8AaDRDVw7Px44mRiAQCfT12fW2kfkD/wA5ZarpOl6of+cnLy0bUbSC6NpIbstEZo1f02INCVrQnM2Om1BF+I+b6n2y9lcOWeP+SonhkRfp3o1fxQOs/wDOP/8AzmpZ28k2jf8AORA1qVASLR7+8tXenZS0LpU+7AYJaXUjlO23S+2fsbklWXs3gHfwxkPvB+QKa/8AOImvfncn5p/mb5F/OfXtZvtT8t6Tayx6Zqdx9YjjaWb4ZoXUlWV0OzKaEZLQyy+JKOQnYOP/AMErR9insvS6vsvHCMck5DiiOEmh9JHMEHoX6HZtHxR2KuxV2KuxV2KsH/Mby15g83eUNT8v+V/N9z5E1m+aD6t5ns4/Vnt1jmSSQIvJPtqpQmuwOV5YGcaBo97tuxNfp9Dq4ZtRhGeEbuEjQlYIF7Hkd/g/OP8A5yK8q/8AOQX5E+S7Lzpb/wDOSPmLzLaz6pDplxYyc7WRDPHLIsisJZAwBioRQda5qtVDNgjxeITu+4exHaPYHtHrJaWXZmLGRAyB2kNiBXId7H/+cabL/nIL/nIKx806pL/zkN5k8r2Xlye3tUCl7p55Z1Zz1kjChVUeNa5DSDNnBPGRTm+3eXsD2Ynixjs3FllkBPSNAUO43f6H6cflt5V13yZ5SsdB8y+cr7z7rNvJNJd+ZdQHGab1ZCyLx5PQIpCjc9M2+GBhGibPe+Cdu9o4Nfq5ZsGCOCBAqEeQofDmd2eZa6d8M/mN+UH5r+X9P84+etQ/5yw17y3oVj9c1Rrc2xFvaxMzPHAgFyCQKhFAFTsAK5rsuDJEGRyEB9b7D9peytVkwaOHZGPJklwwu/VI8jI+n/OJ6dXxv+RF/wD85Z/nzrU1poX5seYtI8u6aQNc82XVzK1tbkioijUUMsrDcICKDdiozA0x1Gc7SIHe+n+1+H2V9m8Ilm0eKeWX04wBxS8z/Nj5/IF+pX5Pfl352/L6z1uHzt+aWp/mfdanNC9lc6jGYxaJErBkjUySfbLVJr2GbjBiljB4pcT8++03bei7TnjOk0kNMIg2Im+InqdhyeyZkPLuxV2KuxVZLFHPHJDNGs0MylJYnAZWVhQqwOxBHUYpjIxIINEMF/MOS00P8svPEkEMVnZ6Z5a1IwwRKEjjWO0k4qqqAABSgAyrLUYH3F2/YgnqO0sAJJlLLDc7k3IPyW/5946Q17+dOuaqVrFovle6IbwkuLi3jX/heeaTsuN5Se4P0f8A8GvU+H2Njx9Z5Y/KMZH76ftNnQPyw7FXYq7FXYq7FXYq7FXYqskkSGOSWVgkcSl5HPQKoqSfkMUxiZGhzL88fJP/ADnHd+ffz20b8vtC8oW7eRtc1GTTLDV2kkOoPRWKXZUH01QlalKVC78qjNXj7R48oiBsX2vtX/gSw7N7Dnrc2Y/mIREjGhwdLh33vV9T0fojm0fE3Yq7FXYq/Pn/AJy28/8A5vXv5g+Rvyj/ACMu9Wh8ztYT6z5gGjyenJ6UriKATyGixxoEdiWIHxL3pmr12XIZiGO757PtH/A37G7Jx6DP2l2uIHFxCEOMWLAuXCOZJsDbfYsN0L8if+c59SiSbV/zyXy7y+1bTavc3Ey/MW8Dx/c+QjptUec6+Ls9X7X+xGI1i0HieYxxiP8AZSB+xl6f846f85ahS03/ADlFPGAKni14w/Hjk/yuo/1R1p9t/ZTp2UP9i+Lvyu/Mf/nIv81fzJ0v8udG/O7XbWfVJrlI9YluZXiWO2jklMpRfioVj2Hvmvw5c2WYgJl9T9oOw/Z7sbs6euy6HGRED0gC7kQKv4vtRv8AnHP/AJyzA+D/AJyjuGbsCbwD76nNh+U1H+qPlY9uPZTr2SP9i8187/lD/wA50eU9Ou9V0v8AN6886WtnG0strpWpzrecEFSVguIow5p2RiT2GVZMGqiLEr+LveyfaX2I1uQY8mjjhJNXOA4f9NEmveQA+v8A/nEvzP5h84fkT5R1/wA06zda9rd5Lfrd6neP6kz+neSooZu/EKF+jM7QzM8QMjZfNP8Agj6DT6HtzNh08BjxgRqMdgLiD9vN8+ee/wDnOefRfzpt/wAuvKflO21ry7p+tw6HruqzSSfWri4M4gn+qIh4qI3JC8g3MjsDmLk7R4cvBEWLp7Psj/gSR1HYx12pzGGSWM5IxAHDGNcUeMnfcc6qr6v0UzaviSFtrKzszcG0tIbU3crT3RhjVDLK/wBqR+IHJj3J3wAANk8s8lcRJoULN0O4eT8LryFfNf8Azm/PbxD1Yp/zQMZpuClnf0ZvkBETnOH1ar/O/S/XGKZ0XsUJHYjSfbKH7X7t50j8huxV2KuxV2KuxV2KuxV2KuxV2KuxV+bv/OTXnf8APTzZ+dGm/lV+Qd9rEF15Z0iO580HSZlt4lnvmDqbudiqIqRhOPIjdjSuanWZMssvBivYbvufsF2T2Houxpdo9sxgRkmRDjHEaht6I8yTK7odBaB0X8hf+c4b6JJdX/PtNCLCrW7apd3Mq+x9K34fc5wR02qPOdfFt1Xth7FYzWPs/j8+CMR9sr+xN9V/Ib/nK3RdH1XWb/8A5yjuEttIs57254Ndn93bxtI2549lyUtNqACTk5ONp/bD2W1GaGKHZQuchEfTzJp8m/kh53/5yR/O/wA8x+SNJ/O7XdGnaxuL+XUbm4lljSO3C7FUofiZgMwtPkz5p8ImQ+j+1nZPs57PaI6vJoMcxxCNAAEmXv8Ac+xH/wCcc/8AnLQKfT/5yjuHbsGa8UfeK/qzO/Kaj/VHzEe2/sp17KH+xeQfmP8Alt/znJ+Xujaj5ij/ADYv/N+j6VA9zqD6Nqc7XEUEY5PIbeeKJmCipPDkaZRlxarGL4rHkXpuw+3fYntTNHAdHHDOZAHHAcJJ5DiiSBfnT7//AOcd9b1jzJ+SX5b67r+oz6trOqaPHPqGpXLc5ZpC7/E7HqaDNnpZGWKJO5p8a9ttJh0nbWqw4YiEIzIERyAocns+ZDyzsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVf//Q+/mKuxV2KuxV2KuxV2KuxV2KpJrPlvQfMR0ltd0i11Y6DqEWq6MbqNZPq17AGWK4i5fZdA7UPauRlASqxycvS67PpePwZmHiRMJUa4oGrifI0LCd5JxHYq/Bj/nJaVvPH/OWHmXSeXrRz6/pmgRAeCJb2zL9D8s5rV+vUEeYD9g+wkf5O9lcWTkRjnk+ZlL7qfvHFGsMUcSCiRKEUeyigzpX4/lLiJJ6qmKEImn2Ed7NqcdlbpqVzEkFxqCxqJ5IoySiPIByKqWJAJoKnBQu205shgMZkeEGwL2BPMgcrKLwtTsVdirsVdirsVdir86f+fj2sfV/y48haEGodU8xSXhXxWytJE/XcjNV2rL0RHm+3f8AAO03F2jqM383EI/6eQP+8ZB/z7x0YWP5M65q5BD655luSCe6W0EEQI+nlk+y41iJ7y4X/Br1XidsY8X8zEP9kZH9T72zZPjyWazrOleXtKv9c1zUINK0jS4WuNR1G5cRxQxIKszsdhglIRFnk36XS5dVljhwxM5yNADckvzo1U+dP+c3/NY0/SnvfKH/ADjd5Vvv9I1ZlMdxrtzCaExqw3P8oNViB5NVyFGqlxa2VDbGPtfb9P8Ak/8Age6XjycObtPLHaPOOGJ7/wBPWfIVGy/QXyj5Q8ueQ/L2m+VvKelQ6NoelRiO0soRt/lO7Gpd2O7MxJJ3ObPHjjAcMRQfGO0u09R2lqJajUzM8kjuT9w7gOgGwZLk3Adir8//ADn+XH/OavnrzTq/mDSPzD0v8tdEuJSmjeVLfUpmFvbJtH6jQWsitIw+J2r1O1BQZrMmLVTkSJCI7rfZey+3PYzs7Sww5dNPU5APVkMB6pHnXFIERHICuXmxn/lQ/wDznH/7EDZf9xG9/wCyLIfltV/P/Hyc/wD0YexP/ROl/pIf8W035C/85xMpU/8AOQNnQihpqN6D94sq4/ltV/P+39iR7YexI/510v8ASQ/4t9u/lP5G1P8AL/ybYaJr3mnUPOfmSVjd+Y/Meo3Es73F5KB6npeqSUiWgVF8BU/ETmwwYzjjRNnqXyf2j7Xx9p6yWXDijhxDaEIgARiOV1zkecj3+VMQ/wCcoNVGjf8AOP8A+at5z4GTQ5bNGrT4rxlthT6ZMhrJVhl7nZ+wGn8ft7SR/wBsB/0ty/Q+I/8An2xo5Nz+anmAj4Ui0zT0b3Zp5Wp/wIzXdkx+o+59X/4Ouq9Okw+c5f7kP1VzdPzw7FXYq7FXYq7FXYq7FXYqpyxRzRSQyqHilUpIh6FWFCD8ximMjEgjmHzb+Vf/ADij+U35Q+bL3zn5btL671qb1U0t9RnEyafFNs6WyhFoSpK8mLNx2rua4mHRY8UuIc3uvaH/AIIvavbmljpc5iICuLhFGZHLi3PvoUL37n0tmW8I7FXYq7FUlg8uaDba7f8Ame30m1h8xapbQ2WoaysYFxNb25Zoonk6lVLEgZEQAN1u5U9dnngjp5TJxxJkI36RI8yB3lOsk4rCfzK1keXfy789a96gibSNA1G7jcmlHitpGT/hgMrzS4YE9wLtewtL+a7Q0+Hnx5ID4GQt+P3/AD780U6l+e0+pFap5e8uX93z8HmeG1A+ZEzZouzI3lvuD9M/8GfVeF2GMf8AqmWI+QMv96H7b50L8ouxVB2Gn2Gl2sdjpljb6dZRFjFaWsSQxKXYsxCIAoqxJO3XAABsG3NmyZpceSRlI9SST8y+ctG/5xM/KPRfzTvPzaisb27124v5NVtdMuZw9hbX0zmR7iOLgGLc2LKGYhTuBsKYsdFjGTj6vcar/gj9rajsuPZplEYxEQMgKnKAFCJN1VbGgCRz636ZzLeCWu6xo8jsFSNSzsewAqTikAk0H4d/84qWzecv+cubXXJR6qQX+va9Oeoq8dwEP0STKc53RDj1F+8v1n/wRMn5D2TOEbXHFjHzjf2RL9xs6J+S3Yq7FXYq7FXYq7FXYq7FXYq7FXYqkun+XNB0rVdc1zTdItbLWPMzwSeYNThjCzXjWsfpQGZxu3pp8K16DIiABJA3LlZtdnzYseHJMyhjvgiTtHiNyodLO5TrJOK8V/5yM1pvL/5F/mnqaOEkXy9d20bH+a7T6sB9JkzH1cuHFI+T1XsPpfzPbmkxn/VYn/Sni/Q/Of8A59waMLj8w/P+vleQ0ry/FZKx7NfXSSfqtjmq7Kj65Hyfb/8Ag46rh7P0+H+fkMv9JEj/AH79gs3r8zLXRJUeORFkjkUrJGwBVlIoQQeoOKQSDY5qFnZWenWtvYafaQ2NjaIIrWzt41iiiRdgqIgCqB2AGAADYM8uWeWRnMmUjuSTZJ8yUTha3Yq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYqpzTRW8MtxPIsUECNJNKxoqqoqzE9gAMWUYmREQLJfAn/ADip588xfnB+c/56fmDdaxfXHlKxaDTfKujyzyNawQTzSei0cJbgGMVqCxA6sfHNZosksuWcr26Psf8AwROx9P2H2PoNFGERmlcskgBxEgC7POuKe3kPJ9/5s3xp2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2Kv8A/9H7+Yq7FXYq7FXYq7FXYq7FXYq7FXYq7FX4H/lmzfmD/wA5haRqDD101jz/AHesODuDFDczXhHyCR5zWH95qQe+Vv2J28P5M9kZw5cGmjD4mIh95fvhnSvx27FXYq+cPNf/ADkfotrr975L/LLytqv5xedtO21PTNA4LY2LVIC3uoyfuYjyFCByodjQ5iT1YB4YAyPl+t7ns72HzTwR1Wvyw0eCX0yyfXP+pjHql9nk+a/PH/OZf5z/AJUeYtLs/wAz/wAiLby5pWp1lt4U1L15ZYVIEno3cQkgd0qKrQHpXjWuYmTX5cUhxwoe97rsn/gX9j9taecuz+0DknHY+igD0uBqYB7/AJXT9BPKnmXSvOXlrQvNehymfSPMVjBf6fIw4t6U6B1DDejCtCOxzaQmJxEhyL4x2joMug1OTTZhU8cjE+8Gvl3J/knDdirsVdir8lP+fkmsmXzN+Wfl9ZKrZaZfX8kXgbmZIlP3QnNJ2tL1RD9If8AzS1ptVmr6pxj/AKUE/wC+fZ//ADhzog0P/nHP8uoynGbUoLvUpj05fW7yaRD/AMiyozP0EeHDF8t/4J2r/Me0OpPSJjH/AEsQD9tvcPO3njyt+XXly/8ANfnHWINF0TTlrNczH4nc/ZiiQVaSRjsqqCTmTkyRxx4pGg8l2V2Tqu1NRHT6WBnkl0H3k8gB1J2fD1ho/n3/AJzN1i11zzTBfeRf+cctLuRNonloMYr7zG8bfDNOynaPbqPhXpHVqyDXCM9Ybltj7u99ZzanQ+wWE4dOY5+05CpT5wwX0j5+XM85UKiffWi6LpPlzStP0LQtOg0nR9KhW307TrVBHFDEgoFVR0/jmzjERFDk+O6rVZdVllmzSM5yNknckpnhcd2KuxV89fmX/wA5OflZ+Weo/wCHbrUbnzV5yZjHF5O8uwm/vvUoSEkCEJG3+Szcv8nMXNrMeM1zPcHtewfYHtTtbH48YjFg/wBUyHghXeL3I8wK83nsn/OQf5830ZvfL3/OJ+vzaZTlHJqmrwWFyy/8wzwM4J8BXKvzWU8sZ+buo+xfYWM8GbtfGJ/0MZnH/TCVPFNP/wCcs/O35zfml+Vv5aeVdG1D8sb1fMkq/mLamSG8aa0sqSS2yyvCjR0WKVX+EGvHfMca2WbJGERw77vVZv8AgcaLsHszV6/UTjqY+EPBNGNSnsJUJEHnEjc9dn6ZZt3wZ8Zf8556wdN/5x71azDcTr+s6ZYEeISU3Z/6h8wO0pVhPmQ+o/8AAf03jdvwl/qcJy+zg/3zDv8An3Zon1L8n/MutOvGTXPM86o380VrbW6Kf+DdxlfZUaxk95dn/wAG3VeJ2vixDlDEPnKUj9wD1n8/P+cr/IX5Gn9DPG3mzztJH6ieWLOVYxbqwqj3k5DiIN2UKzkb8ab5fqdbDDtzPc857Hf8DrX+0X70HwsAP1yF33iEduKu+xHzvZ87flT/AM/BU80+c9L8t+ffJ1p5d0rXbpLOy12wuZJBayzMEi+sRyr8SFiAzqRx68SOmJh7U4pVIUC9v7Rf8Bg6PRzz6PMck4AkxkAOIDc8JHXuBu+Vv0uzbvg7yf8AMz87fy5/KWCD/F2uBdWvqforyzYobvU7sk0AhtY6tQnbk3Fa7VrlGbUQxfUd+7q9H2D7Kdo9tyP5bH6I/VOR4ccffI7fAWfJ8Y2X/Ofd75l/Mnyt5J8tflm1hY63r1lpF5d6xdMLxFubhIJG+rxIFjZAxNC7dMwB2mZTERHma3fUcv8AwHIaTs7Lq8+q4pQxymBCPp9MTIeoncH3B+k2bZ8Ldir5r8r/APOVH5Z+cPzSl/KPRLfWpvM8V/qGntctaoLL1NNWVp39USk8CIW4njvt45iQ1sJ5OAXf6nuu0P8AgedpaHswdpZTjGIxhKuI8dZK4RVc/UL3730pmW8K+bfzU/5yn/K/8r7i+0c3N15y81afE8175Z8vx/WpbZIwC7XcoPpQBQfi5NyH8uYmbW48e3M9we69nv8Age9p9sRjloYcMiAJ5DwiV/zB9Ur6UKPe8n/5x9/5y+1r89vzPuvJ8fkW18vaBBpVzqH1z649zdKYXjROR9ONKMZOgXbxyjS6458nDVCno/bP/gaYfZzswak6g5MhmI1wiMdwSepO1d77qzZPkTsVdirsVdirsVfNv/OXetDQv+cdvzLuOXFr2xh06P3N7cxW5H3OcxNdLhwye6/4Gul/M+0Olj/NkZf6SJl+h8a/8+2dFLan+aXmFk+GG103ToZPeV5pnH/JNcwOyY7yPufUP+DpqqxaTB3mcvkAB95fq5m6fnV2KvD/AM0f+chPy2/KiZNL1rUptZ81zpysvJeixG91OT4SwLRIaRggVrIVqOlcx82qhi2O57hzes9n/YvtHtoeJiiIYRzyTPBjHxP1f5oPnT5i/LL/AJzh1P8ANX83vK/kDRPy8h0nQ9cuZobi/u7xprxI4oZJTJwjjRFI4birfPMPD2icuQREaBe+7e/4E2LsbsnLrcupM8kACAI1GyQKskk8+e3ufobm0fFWGfmNq66B+X3nnXHbgukaBqV4X6U9G2kcfqyvLLhgT3Au07D0x1OvwYR/HkhH5yAflJ/z7n0YXn5oedNddSx0fy76CSeD3lzH39xEc0vZUbyE9wfon/g36rw+zMGEfx5b/wBLE/8AFP02/Nn86vIH5L6GNZ87asLeW5DDStFtwJb69deqww1GwruzEKO56Zt8+ohhFyL4L7Oeyuv7fz+FpIWB9UjtCP8AWP3AWT3Pz98wf8/GvMtvqEbaP+VFvZ6NKedqdVvJvrE8Vftgxxoi1HhzA8Tmsl2rK9o7Ps2i/wCAhppY/wB7rCZjnwRHCD3bkk/7F92fkN+eXl38+PJzeZtFtZdJ1Cwn+p+YNBncSPa3HEMOMgCh0dTVWoK7ggEHNlptTHPGw+Q+2HslqPZvWfl8pE4yFwmNhKPu6EdRv73t2ZDyjsVeA/mb/wA5K/lX+V18NC1PVZvMHm6Q8IPJ2gwm+1AyEGiOiEJGT4OwPgDmNm1ePEaJs9wey7A9hO1O2IeNjgMeHrkyHghXeCdz8AR5vN2/5yE/PXUoze+Wv+cUfMFxphHOOXVtVg064ZeoP1Z4GbceBOU/msp5Yz8TTvB7F9h4jwZ+18Yn/QgZx/0wlTw2T/nLfz3+bP5hfl1+VPlby/qH5VeYpvNiWnntDLBeyfU7Yk3UCPJAjIVVJC3wA7DfrmP+enlnGAHCb3euj/wN9D2L2fqe0dRkjqsYw3i2MRxS+mVCRBsmNb9eT9OM274G7FXYq7FXYq7FXxz/AM53a1+if+cedctQ/B/MGq6ZpyEGhNJvrTD6VtzmB2lKsJ8yH0//AIEOl8b2gxy/1OE5fZw/fJ45/wA+3dGEPlH8ydfaOjX+r2djHL4rawNIR98+Udkx9Mj5vT/8HPVcWr0uG/phKX+mNf71+lObZ8Jdiqhc3VtZW895eXEVpaWyNJc3UzrHHGiirM7sQAAOpJwE0zx45ZJCMQSTsANyfcHyjrv/ADl/5GbWZvLX5YeW9f8Azm1+A8ZovLFq0loh33a6YUK7faVWX3zDlroXUAZHyfRNJ/wNNcMIz9oZcejxn/VZVI/5nf5Eg+TE/Mv/ADk5+eHk/SbvzP5l/wCcW9R0vyvYL6t/qTa/A7wxVA5yRx2rFeo6j6crnrMsBZx7e92Wg9gexddlGnwdrRlllsB4RFnuBMhbX/ONX53eb/z+/NP8xvM6z3ekfln5e0vT7TQ/KUohIjvrsAySySogaRgYJSPioFZdhjpNRLPkkeUQOS+3fsppPZrsvTaeoz1WSczLIL3hHkACaA9UenMHd9la/wCYdC8q6Td675k1e00PR7BOd5qV7KsMMY92YgVPYdT2zPlMRFk0HzDR6LPrMscOCBnOXKMRZL4O/Mr/AJ+A+UfLRSHyL5L1PzbHc8/qHmDUOemadcBGKs9vzjeWVQafsp881ubtOMfpF/YH1/sL/gM6vV76zPDFXOEayTF9JURGJ+Mn1X+RH5j6l+bX5WeWPP8Aq2l2+j32vC6Mun2ru8SCC6lgUqX+L4ljB38czdNlOXGJHa3zv2v7Dx9idqZdHjmZxx8O5q94iXT3vIPz7/5zC8ifkvdzeW7C1bzp53hH+k6LazCK3syRUC7uOL8WpvwVS3jxqMo1OvhhNDcvTex3/Ay13b8BnmfBwHlIi5S/qR2sf0iQO63kv5I/855w+f8Aztpnkvz15TtfLJ8xXC2mia3Y3DyQrcyGkUNxHKKgSNRQ4bYkVWm4o0/aXiS4ZCrek9rP+A+ezNFPVaTMcnhi5RkADwjmYkd3OiOXXo/RfNq+IOxV4r+bH58+RPyj+pWGszXOt+bNXIXQvJGjRfWtTu2bZOMKkcFY7BmIr+zU7Zj59TDFsdyeg5vVeznsfru2+KeICGGH1ZZnhxx79+p8h8aeQ3/5t/8AOV11aya1oP8AzjdZWmlKvqQ6ZqetwvqckXWphRouLEfsEFu1CcoOfUHcY9vfu9Lh9m/ZaEhizdpyM+XFHGfDB95Bsed0w/yV/wA59+QL29n0T80PLWqflnrljK1vfc0kvraOWMlXWQJEk8bKRupiNPHK8facCamDEuz7V/4DmvxwGXs/LDU45CxyhIg8qsmBHnxM4l/5y68k+bPzA/Ln8vfyivF843/mjWUj8x6hJaXUEFppkcUklw0frLCzS0WoNCoANe2W/noynGOPezv7nUx/4G2t0Wg1Ot7Sj4McULgOKJMshIEboyHDv3gk1T7AzOfM1rukSPLK6xxxqWkkYgKqgVJJOwAGKQCTQ5vlrzX/AM5b/lzpWtyeVPI+n6x+bnmyNij6R5Ttjdxo4NCHufsGh6lOQHzzCnroA8MbkfJ9B7O/4G3aObCNRq5Q0mH+dmPCfhHn86YhrH/OR359aNpt55gvP+cUtVtvL2nwvdXl1NrsAnjgjUu8jwJas6hVBJ22yEtXmAvwzXvdnpfYfsLUZI4Y9rwOSRAAGI0SdgBIyANljP5Ef85D+bf+chvzxln0j655X/Ljyr5Xa41TytIYJRPqc0voo0k6xh2WjkqKj7HTrkNNqpajLttEDl5uf7X+xWk9l+xAMvDl1OXLUZ7isYFmo3Q5Uef1c3307rGju32UBZu+w3zZvjgFmn5rf85Df85laTfflv5k8seSvK3mnTdU8yRSaS2v6tYGwtoIJqpO0bMzMzvHyVRQUry7UzU6rXgwIiDv3vuvsV/wL8uPtHFqNXlwyhjInwQlxyJG8b2oAGiefd1eaf8AOHn54+S/yf8Ay81qx1ryz5r1XVdf1qS8kvdH0pru29GOGOGNBKHWpUqxIptXKdBqI4oEEEknoHff8E32S1nbvaEJ4suGMMeMRqc+GVkkk1R8vk/Rz8qfzi0D83rbWbrQND1/RotElhiuP07YmyMjTq7D0QXblxCfF4VHjm1w5xlugRXe+He0Xsxn7DlCObJjmZgkeHLjqq57Cue3xetZe84gNU1XTND0+71bWdQttK0uwjMt7qF3KsMMSDqzyOQoHzOAyERZbtPp8uoyDHiiZzkaAAsk+QD5Rv8A/nL/AMt6vqdzon5Q+QvM/wCcl/aMyXF5otq0OnIwp9q6lUkDfrwp4EjMI66JNY4mXu5PouH/AIGmowYhl7T1GLRxPITlcz/mg/ZdsR82f85V/nD+XumnzH58/wCcY7/QPK8ckcdxqo16Cf0jKwROYjtiAWJAAYjfK563JjFyx0Pe7Ls7/gd9kdqZPA0fakcmWjUfCIutzVy+62S/84q/mn5x/OrVPzX8/wCrX91H5MOrQaZ5H8tzJCqWUccZllBaJQXfjJHyYsa17ZPRZpZjKR5XsHA/4Ifs9o/Z/FpNFjiDn4DLLMX6yTQ5nYWJUKD7GzPfMXYq7FXYq7FXYq7FXYq7FXYq/wD/0vv5irsVdirsVdirsVdirsVdirsVdirGPO2rLoPk3zZrbv6a6Po99el+lPQt3kr+GQyS4Yk9wc/srTHU6zDiH8c4x+cgH4uf84H6UdY/5yH07UpR6jaHpGqaizn+eWMWtfmfrBzQdmxvNfcC/U3/AAX9R4Hs/LGP45wj8jxf71+5WdE/JTsVfBf/ADk3+cHmfXvOmg/84z/lJfG183eb5IoPOHmCFiH060nXm0SspBQ+jWWVhuEoF3bbW6zPKUhhhzPN9h9gfZnTabR5O3u0o3hwgnHA/wAchtfn6vTEcjLc7Df1l+WH5ZeVvyl8oab5P8qWS29pZoDe3rKPXvbkgepcXDjdnc/QB8IoABmbhwxxR4YvnHb/AG/qu29XLU6mVk8h0hHpGPcB9vM7viT/AJ+K3Wn3nlH8uvLdtwvfNN5rzzadpcH7y7MBgeNisS1ch5GRRtuRt0zX9qkGMR1t9X/4COPJj1epzy9OIY6MjtG7B58thZ8g9U/5xi/Lb82dJ0byVq/5oXo0DT/J2hPpHk78vLWoZBcFWlvtTbkeU5UcVj6ID2aoy7R4sgAM9qFAfpLz3t9272VmzZ8XZ8fElmyceTMf6PLHi/odTL+I94p9k5nvl7sVdirsVfh1/wA59az+k/z/ALqwDVHl7QdNsSvg0ivdn8LgZzvacrzV3AP1n/wHNL4PYIn/AKpknL5VD/ev0G1L88PIX/OOP5Qfl15e1SVtZ84ReWtMt9G8j2JDXs8ptowDIAG9JC5pyYVP7IY7ZtDqIafHEHc0NnxjB7J672q7X1OfGODCcszLLL6AOI8v5xroOXUgPgXyf+bWn/n1/wA5CaB/0MdNMnllbqS18ueUVYwaTY35cLBBdxP8RVmHB2Y8mbiHPCoGsx5xnzDxeXQdH2PtP2byezfYGT+QwPFoGeTnknCvVKBG1jnEDYC+H1bv20gghtoYba2hS3t7dFjggjUIiIgoqqooAABQAZ0IFPylOZmTKRsnck9VXFi7FXYq/Pn/AJyA/Pnzj5z8+23/ADjh+QlwR5o1GY2vm/zfAxX6iqis8MMq19P0kBM0g3X7CfHXNXqtTKc/Cxc+pfaPYz2P0eg0J7c7YH7qIvHjP8f80kdeI/RHkfql6X0f+Sf/ADj55F/JTSEj0izTVvNd2gOvec7xA97dStu4RjUxRk9EU/6xY75l6fSwwjbn3vDe1ftprvaDLeWXBhH0Y4n0RHS/50vM/Chs9vu7hLS1ubqRgsdtE8sjHoFRSxJ+7Mgmnk8cDOQiOZNPx4/5wL0lvNn57+c/PNwhZdI0y9vFc78bnVLkItfcx+rmi7NjxZTLuH3v03/wYdSNF2Hg0kf45xH+bjj+vhfsfm+fmF+bf/PyHWBB5L/LnQVko2o6zdXrx+K2luIwfvnzU9rS9MR5vun/AADdLxazU5q+mEY/6aV/71U/K3z7qH5Qf84ofllpHlKxGs/ml+aFzfQeQdDChme5u7uWt1IpoPTt4+JJO1eIO1SHDlOLTxEd5S5MfaHsfH257U6rLqZcGk0oicsu6MYj0D+lM2BW/Ot6e9fkx/zi95S8gwP5l88QW/5hfmlrbG88yeatVQXYS5lPKRLVZgQoBNOdObew+EZWn0cce8t5HmXj/an/AIIGr7Sl4GkJ0+khtDHA8PpHIzrn/V+keZ3Pzs/5zw8kaB5K/OLR73ytp0Gjf4l0WHUbyyso1hiF2lxLCZVRAArOEUmg3O/UnNV2ljEMg4drD7Z/wIO1s/aHZE4aiRn4eQxBkbPCQDVnus/DZ+0mhNM+h6M9wS1w9jbmdj1LmJeRP05v48g/LOsAGeYjy4jXzYlpH5VeQdE84a95+svLlu/nHzHMJtR8wXHK4uFoixhIGlLeilEFVjoCeuQjhhGRlW5dlqfaLX6jSY9HPKfBxihAemPMm5V9R35yt+PnkaMecf8AnOgzxxh4v8f6nfMANuNhLPLy+kxA5osfr1X+cX6Z7Wl+Q9iKJ3/LQj/pxEf75+4udE/JiC1K9j03Tr/UZv7nT7aW5l/1YkLn8BgJoW24MRy5IwHORA+Zp+OH/OBtnJ5l/wCcgvM/mucGQ2Oj6lftI3UTX1zGnL5kO+aHs0cWYy8i/T3/AAYMo0nYGLTjbinCPwhEn9AfsxNFHcQywSjlFMjRyKCRVWFCKihG2b9+XoyMSCOYeE6n+XXkH8oPyc/Ma18m+XbXRrOHyzq9xqFyAZbq6ZLOVi9zcSFpJWNP2mPtmMcUMWOXCK2L12n7b1/bnbGmlqshnI5cYA5Rj6htGI2iPcHwH/z7c0f1/On5k6+VqNN0W0sA3gb24Mv/AGK5rOyY+qR8n2T/AIOeq4dHpcP87JKX+kjX+/frtm8fmt2KuxV2KuxV2KvhD/n4VrY0/wDJPS9IV+MvmDzLaRsn80VvDPO33OqZre1JVirvL6//AMBbSeL21PJ0x4pH4yMY/daVf8+6tF+p/lN5r1thRta8yyRKfFLS2hAPy5SNg7KjWMnvLkf8G7VeJ2rhxfzMQPxlKX6g/QTNm+MOxV555R/KvyB5E1HXtc8ueXbay1vzJeXF/reuy8p7yaS4kaV1NxKWdYwWNEUhQO2VQwwgSQNy7vtL2h1/aWPHhz5TLHjiIxiNogRFD0igT3k7l+SP/OE9inmD/nKC91mNB6OlWWt6qlBQATuLZdv+jnNJ2eOLPfvfpD/gq5jpfZmOI85Sxw+Q4v8AeP2xzoH5UfOv/OWes/oP/nHj8z7kPwkvNMTTox05fXp4rZgP9jIcxdbLhwye3/4HGl/Me0Glj3T4v9IDL7wHwj/zhj5x0P8AJ/8AKD86vza8wKZYIr/T9L0yzU0lu7uGGWSO1i67yNcLXwALdBmt0GQYsc5nyfXv+Cj2Zn7c7X0PZuHYmM5yPSMSQDI+4QPvO3V9N/k1+QOoecdYP57f85CWyeYfPvmHjdeX/KN2vOx0OzPxW8X1d6gyKDUK2yd6yVIy9PpjM+Jl3kenc8F7Ue2WPQYf5I7FPh6fHtPIPrzS/iPEP4T3j6unpoM+/wCcvPKnlrW/yB8+XOrabbPceXbFb/QrwxqJLa5ikQJ6TUqvKvAgdQaZbroRlhN9HTf8DXtHU6ft7TxxyNZJcMhe0okG7765+8PlP/n2tZ3yp+bd+wYaZIdHt4j+yZ0+tu9PcK61+eYXZIPqPu/S+if8HXLC9HD+IeIfgeCvtBfqXm5fnx8B/wDORP8AzkB5u1jzrZf847/kPIZvPeszC08yeZIGp+jgy8pIYpB9h40q8sn+6xsvx146zVaqRl4WLmeZfZPYn2M0mDRS7b7YFaeAuED/AB9xI6gnaEf4jufTz71+R3/OOvkn8ltLSW2t01/zver6nmDzvepzu55n3kELPyMUdf2Qanq5Y5k6fSxwjvPe8d7W+2+t7fy1I+Hgj9GKO0QByuvql59OgAe/ySLFHJK5okalnPgAKnMp42IMjQ6vxu/5ws0sedP+cm/N/nSVRNDpEGsaukrCtJr+59FCD4lZnpmh7PHHnMu6y/T/APwU9R+Q9msOlGxmccPhCPEftiH7KZvn5fdirsVdirsVdir83P8An5DrRg8k/l15fWSn6R1q5vpYq9RaW/pqafO4OantaXpiPN9z/wCAbpeLW6nNX04xH/TSv/evVP8AnArRv0Z/zj5pt6V4nzDrWp39e5CSLaD/AKh8u7NjWG+8l57/AIMOq8bt+UP9Txwj8xx/799n5sHy1AarqunaHpl/rOr3kWnaXpdvJdajfTtxjhhiUu7sewAFcEpCIs8m7T6fJqMkcWKJlORAAHMk7APzOj1vzn/znH+YGoaJp97feUf+cePJ9wv6U9AmK41VwSY1lPQySAcghqsS7kFyK6jilrZ0NoD7X3mWk0f/AAPNBHLOMcvaWYem944++v6MeV85nYVG6+inkzyN5S/L3QrXy35N0K10DSLRQFtrZApkbvJK5q0jnuzEk+ObXHjjjFRFB8R7U7X1famc59VkOSZ6np5AcgPIbPn3/nNfWDpP/OOnnZQaNq0un6evifVu4mNP9ihzF7QlWEvaf8CrTeP7Q4P6AlL5RP62Cf8APvvyyuj/AJJXevPGVn82a7dXAcj7UNqqWyU9gyPlXZkKxX3l2/8AwZ9f4/bQwg7YscR8ZXI/YQ+rPO/5ZeSfzGl8vP510OPzBD5ZvGvtMsLlnNsZ2ThWaAEJKANwHBFe2ZuTDHJXELp877J7e1vZQyDS5DjOWPDIiuKrvaXOPvFF+b3/AD8gntLW4/KPQrSCK3jtbXVJ44IlVFjjLW0aqqqAAPhOw8M1XaxrhHvfc/8AgGwnOOszSJJJgLPU+ovUtB/MDzD5B/5xw/I78s/y4tfr35u/mfpAj8r2opSxguWee41KatQqxLJ8JO1atuFYZdHKYYYQh9Uht+t57WdjaftL2i1+v1x4dHpp+s/zzGoxxx7zIjeum3UPdfya/wCcX/y//K7TVu9V0+387+fNRrP5i85avEt1LLcSnlL9XEwf005E7/abqzHMnT6OGIb7y6kvI+1Ht/r+2MnDjkcGnjtDHA8IERy4uGuI/YOgfmb/AM5YeT9F8jf85NWUHk+wh0aHVTo+rpYWiCKKK7lm4OY41AC8mj50HcnNRrcYhn9O3IvvP/A67Tzdo+zUjqZGZh4kLO5MQLFnrQNe4P3HXlxXl9qg5U8e+dE/JZ5vHfz6/Nmy/Jb8tNc86zxpc6jGFs/LunyGi3GoXAIhQ034rQu1N+KnMfU5xhgZfJ6b2P8AZyfb/aWPSA1E+qZ/mwj9R952iPMh8rf84R+QbvzNB5g/5yL8/Svr/nXzjfXFvoWpXdHaG2hb0p5ogRRC8gMQpTiicVoCcw+zsXFeWW5L6H/wV+2YaSWPsTRjw8GGIMojrI7xB76HqN85Ss7h+hubR8Vfib/z8A8tWHl/88LDWdPgjhk81aDa6jqCKihXuYZprYuwpuWSFK165z3acBHLY6h+rP8AgNa/JqexZYpkkYskoj+qQJV85F+nn5Rflb+VWmaT5S/MXyx+XmjeW/MOuaFaXhvrO3CSRC/tkkkSMmvGocg07bZuMGHGAJiIBIfAvaX2g7Uy5c2h1GpnkxwySjUjseCRAJ7+VvcZpobaGW4uJUgt7dGknnkYKiIgqzMxoAABUk5kvJQgZkRiLJ2AfmX5m8/+dP8AnMb8x7/8qfy01a48tfkt5fYN508129Ul1CANx67VWVlIhiOzAGR9hxXUTyy1c+CBqA5l960HY2j9hOzo9o6+Aya7J/d4zygf1x/jl0+mPOz76/Lr8sPJH5VaDB5d8kaFBpFnGq/WbkKGubpwKGW5nI5SMfEmg6AAbZssWGGIVEU+Odt9v63tnOc+ryGcug/hiO6MeQH4O7Cf+cmtW/Qn5Bfmrfep6bNoM9pG9aHneFbZafTJleslw4ZHydr7Bab8x29pIc/3gP8ApfV+h8pf8+4fLAtfJPn/AM4SQgSazrEOl28xG5jsYBK1PYtc/hmF2VCoyl3l9F/4OPaHHrdPpgfogZn3zNfdB+kWbZ8MfmF/z8j81GLSvy18kxSH/TLq91q+iB7W6Lb25I9/Wl+7NP2tPaMfi++/8Azs68uq1ZHIRgP84mUv9zF9e/8AOLHl3/DH/OP/AOV9g0fpzXekJqk4pQltRdrsV9wsoGZ2ijw4Yjy+981/4IWt/N9vaqd7CfCP8wCH+9fQGZTxjHfNvmvQvI/lzWPNnma/TTdD0O3a51C7feir0VV6szEhVUbkkAZCcxCJkeQc3s3s7P2jqIabBHiyTNAfjkBzJ6B+cXlHT/On/OcPnK98z+cZrzy1+QHlS99LR/KlvIYzqM6UISV1PxuFIMsn7FeEdCSw1UBLWyuW0B0733HtLNo/+B5o46fSiOTtHLG5ZCL4AeoHQfzY/wAVcUugfpJ5d8teX/KWkWmg+WNHtNC0awQJa6dZRLFEoHeigVJ7k7k7k1zbQgICgKD4Zrddn1uWWbUTlOcuZkbP48uQfF3/AD8J1dbH8kNO0wPxk1vzLZx8f5kginmb7mVTmv7UlWKu8vqX/AW03idtSydIYpH4kxH63oP/ADhZ5YHlr/nHnyYxQJceYnu9auSBQsbmZljJ/wCeUaDLez4cOEee7pv+Cnr/AM37QZ+7HwwH+aN/9kS+q8zXzt2KuxV2KuxV2KuxV2KuxV2Kv//T+/mKuxV2KuxV2KuxV2KuxV2KuxV2Kvn7/nKnWv0D/wA49/mneBuLXGjNpyeJ/SEsdoQPolOYutlw4Ze57P8A4Hml/M9v6SPdPi/0gM/96+DP+fbujmbzj+ZGvGOq6fo9pYpJTo13O0hH3QZreyY+qR8n2D/g56rh0elw/wA6cpf6UV/vn66ZvH5sYv52802Pkfyf5m84akR9S8taZc6jOlaF/q8bOIx7uQFHuchkmIRMj0dh2V2fPtDV4tNj+rJMRHxNX8Ob8xv+cErWXzj+ZP5t/nb5vuY3vbKE+rqdywWOO41SSSe5l5saKI44eO5oFbNR2aOOcskvxb75/wAF7INB2do+ydMDwyP0jmRjAjEV1syv3h9S6/8An55p/MjVbzyR/wA406PF5kvLeT6vrv5q6irL5f0qv2vSYj/SpQNwFBHejiuZktTLIeHCL8+g/W+e6P2O0vZWKOr7emccSLjgj/fZPf8AzI997+cSzn8qf+cevLn5fajP5y8xajc/mH+aWpjnq/n7WP3kys32ks42LLbxjoOPxU2rx+EWYdLHGeI+qXeXU+0XtpqO08Y0uCI0+kj9OKGw98z/ABn37XvV7voPMp4t2KuxV2KuxV/Pr/zkRJeeef8AnJrz3Y6dIst7qfmeLRNMZiePqRGKyiBIBNOSjtnMaq55yB30/Z/sTGHZ3s1p5z2jHEZy9xuZ+9+sP5Jf84r+VPyvul83eZ7x/wAwfzPuSJbzzbqVZRby0oRZpIWK0G3qMS9OnEfDm60+ijj9R3l3vzn7V/8ABD1XbEfy2nj+X0o2GOO3EP6ZHP8Aqj0+87vjP/nPL8gToOr/APK6PKtnx0jXZli87W0Q2t79zSO8oOiznZz/AL8oer5gdpabhPiR5Hm+of8AAf8AbL8zi/krUS9cBeIn+KHWHvhzH9H+q+nf+cL/APnIH/lavkz/AAd5lvfU8+eSoEjmlkb95qGniiRXVTuzpsknvxY/azM7P1Xix4TzDwP/AAUvYz+RtZ+awRrT5iTtyhPmY+484/EdH2xmwfKnYq+fP+cnfzZb8nfyj1/zHYyrH5i1Kmk+VgaVF7dBgJQD19GNXk+agd8xdZn8LGSOfIPaewPs5/Lva2PBMfuo+uf9SPT/ADjUfi+cP+ffn5apYeT/ADB+berxm51/zpeS2em3k1WkWxtn/fOGbes0/Lke/BcxOzMNRMzzL3H/AAZ+3Tk1ePs3FtjwxEpAcuOQ2H+bCq/rF+iWbV8TeOf85B+ak8mfkr+ZWvNII5YtCurWyYmh+sXqfVoae/OUHKNVPgxSPk9P7F9nHX9s6XDVg5Ik/wBWJ4j9gfG3/PtzREh8qfmX5iKUl1DVbLT1k8UtIHlp99xmB2TH0yPm+of8HPVmWq0uDpGEpf6Ygf71+lmbZ8IfkD/z8g1n6x5+/LzQA1Rpeg3F8y+DX1yY/wBVqM0Xa0vXEeT9L/8AAN0vDoNTm/nZBH/SRv8A376J/wCcO/Kb+aLDSPzc1m2ZbLy9oNr5N/K+ymWn1eztIwNSvVXcc7m6aReXXiCPskZl6CHEBM9BQ/T9rxP/AATu0Ro8k+zcR9WTJLNnI/ilI/u4e6EOE1ysg833rmyfHn44f85pM/mj/nKPyT5Wi/eGO00PTRGNyJL28dyPukU5oe0PVnEfc/T3/AsA0fsxn1B2uWSXwjED9BfsaiLGiRoOKIoVFHYDYDN8/MRJJsqN3cxWVrc3k7cYLSJ5pm8EjUsx+4YCaZY8ZySERzJr5vxV/wCcGbWXzP8A85J3vmKYc5LDStY1iZ/B7p0tz9/1k5oOzhxZ78iX6p/4LeQaT2cjgH8U8cPhEGX+8ftlnQPym8O/5yT83ReSfyN/MnW2mENxJo0+naea7m51AfVIqDvRpeXyBzH1c+DFI+T1vsL2ae0O29LiqxxiR/qw9Z+6nwx/z7Y0kNffmvrpG8EGlWEbf8ZWuZWA/wCRYrmt7JjvI+59b/4OupqGkw95nL5cI/S/VjN0/O7wL/nKTVTo3/OP35qXavweXRJLND0qbx0t6fdJmNrJVhl7nsf+B9p/H7f0ke7IJf6UGX6Hy7/z7f0gQeRPzD1sx0bUtct7RZPFbS357fTOcw+yY+iR830H/g5ani12mxX9OMn/AE0q/wB6/R/Nq+GuxV2KuxV2KuxV+Wn/AD8m1qiflX5cU/abU9SlHy9CFK/e1M03a0vpHvfoP/gFaXfV5/6kf90T+h9Rf84WaKdG/wCcc/IvNOMurNf6jKf5vXvJeB/5FquZnZ8awh8//wCCnqvzHtDqO6HDH5RF/bb6pzNfPHYqxTz3qn6E8kecdZ58DpWiahdqx2oYbeRx+IyGQ1Anydj2Rp/zGtw4v52SI+cgH5df8+3dK9fzf+ZevOlTZ6TZ2SSnxup2kYV/54DNN2TH1SPk/QP/AAc9Tw6TS4R1nKX+lAH++frhm8fm18N/8/A9ZXTvyKg03lxfX/MVjbAeKwpNcEffEM13acqxV3l9a/4DGl8Xtw5P9TxSPzIj+l8s/wDOF/k9/wA0L3y9pGo2rN5D/KjUrjzVrNrIAYb/AMwX3GDT1cftCCG35/OoOzZhdn4/FIB5R3+PR9C/4KXaY7HhkywP+EaqIxRPWGGFyyV3cUpV9vMP2KzfPzG/On/nMD8yr/8AMW6sP+cavymhfzT5r1u8il85fUTzitIYGDpbSyg8UIfjJKSaIqgNu1BqtdmOT9zDcnm+3f8AAz7Cx9lxl272kfCwwiRj4ucidjIDmdrjAfxE2OT6r/ID8ndP/JD8uNL8nwTJe6tI7X3mXVUFBc30wAkKVAPBAoRK/sip3JzN0uAYYcPXq+ee2XtPk9oe0Z6ojhh9MI/zYDlfmdyfM9yh/wA5GfmqPyd/KbzL5tt3T9Nug0/yzE+4a/uqpE1O4iHKQjuFpg1WbwsZl16MvYj2d/l3tXFppf3f1T/qR3P+m2j8Xyd/z76/Lmui+bPzm10Ne695ovZtN0m+nPOX0I2El3NyNSWmnNCevwe+YXZeLY5DzL6N/wAGftz99h7Lw+nHiiJSA5WdoR90Y8v63k/SPNs+GPMfzp81R+Sfym/MPzQ8npyaVoN61m3/AC8yxGK3H0yuoynUT4Mcj5O/9luzj2h2rptP0lkjf9UG5f7EF8G/8+2dDVNN/NPzKy1e4udN0yFz2EKTTSAfP1Vr8hmt7JjtI+59g/4OmrJyaTB3CcvmYxH3F+oGbh8AdirsVdirsVdir8f/APn4/rQuPzA/L7y+r1OlaBNfOngb25aMV+i2zRdrS9cR5P0x/wAA3S8Og1Ob+dkEf9JG/wDfv0L/AOcZNH/QX5B/lZYGP0nbQoLuVP8ALvC1y34yZtNHHhwxHk+K+3uq/M9u6ud3+8I/0vp/Q91zJeRfmZ/z8F/Ny7s7LQPyY8v3Di58wKmp+a0hPxtbiTjZ2pA3PqSKXYf5KeOajtTOQBjHXm+8/wDAY9m4Tnk7UzDbH6cd/wA6vXL4A0PfLufaX5C/lnZ/lL+VflTyfBEiahDapd+YZ1G82o3Kh7lye/FvgX/JVc2GmwjFjEfxb5b7YdvT7b7Uzaon0k1Ad0I7R+zc+ZL2HL3mH5yf8/G/NaWXkHyP5NjlAudf1mTUriIHf0NPhKbjwMlwpH+rmq7VnUBHvL7h/wAA/s45Nfn1RG2OAiPfM390T831P/zjNoi+X/yD/KrTgnps+gW97Kh2Ikv+V29f9lMczNJHhwxHk+e+3ur/ADXburn/ALYY/CHoH2Re6ZkvIvxc/wCfh+tC/wDzn0DSFeseh+WLZZF/llubm4lb/hOGaDtSV5QO4P1N/wABTS+H2Pky9Z5T8oxiPvt9of8AOJHlCXWNLb86tftDHfa3pdn5b/L+0mFTYeW9JjS3j4D9lrqWNpXp12NfiOZ+hx2PEPUUPcP1vln/AASO0xgy/wAlYT6YTllykfx58hMjfeIRIiPl0faebB8sfjd/zkAiec/+c5PLXl+M81ttW8s6ZMPAD0biSvyEpOaHVevVAeYfp/2MJ0HsTlzHrDNL74j7n7I5vn5gflx/z8m1a8W3/KvQlLCwmk1O/lA+y00YgiSvuqu1Pmc03a0j6R736C/4BemgZavN/EBCPwPET9w+T7J/5xZjtov+ce/ypW0AETaIjvx/368jtL9PMnNho/7mPufL/wDghSlLt/V8XPxPsoV9lPfsyXjX40f85iRXf5s/85SeXvy68u/6VqFpZaZ5fHpjl6c1xJJdSs3tEk/JvAA5odfeXOIDyD9Q/wDAxlDsX2Yya7PtEynk94iBAf6Yxoe9+w+kabbaNpWmaPZrxtNKtIbO1XwjgjWNB9yjN7EUKfmXU55ajLPLLnORkfeTZfCX/OfP5v3Hk3yHp35c6JdG31nz/wCodWkjNHj0mEgSLt09dyE91Djvmt7Tz8EOAcz9z67/AMB32Zjr9dLXZRcNPXD55Dy/0g395i9l/wCcS/yutvyw/JjyzBJbCPX/ADTCmu+Y5iBzMt2oeGInrSKEqtPHke+ZGiw+HiHedy8v/wAEf2gl2x2zlIN48R8OA8o7E/50rPurufTGZbwb4c/5z/8ANMei/kcugLLxufOOtWdoIu7QWhN5IfoeKMfTmu7TnWKu8vrX/Aa7POo7b8atsOOR+MvQPsMmb/8AOFWhjRP+cdfJDFQsusvfanKaU5evdSKhP+wRRlnZ8awjzdT/AMFTV/mPaHP3Q4Y/KIv7SX1Zma+dvxM/5zt1WbzR/wA5DWnlm3k9Q6JpWmaVFGN+M12zXBH0idc57tKXFmruAfqz/gQ6YaP2fOeQ+uc5/CPp/wB6X7O6DpkeiaHo2jQqEi0mxt7KJF6BYIljAH0Lm/iKAD8uazUHUZ55TznIy+ZtNsk4z8oP+c6/zI1Xzp598qf84/8AlWYyJFc2cmt28bEC41S/YJZwPTqIkcPTpV/Fc0vaWUzmMUfwX6L/AOBF2Hi0Ghzds6gcxLhP83HDech/WIr3R836Vflz5H0n8tvJHlryRosapY+XrKO29RRQzS/ammb/ACpZCzn3ObbFjGOIiOj4T252tl7W1uXV5T6skifcP4Y+6IoD3M1yx1T8p/8An5H5qR738tPJEUgMlvDea3fR9wJWW2tz9Ppy5pe1p7xj8X6I/wCAZ2cRDVasjmYwHwuUvvi/SL8tNEXy1+XfkXy+qemdG0DTrN1pT44raNXJ9ywJObbDHhgB3APhvb2r/N9oajN/PyTPzkaZtljqXYq7FXYq7FXYq7FXYq7FXYq//9T7+Yq7FXYq7FXYq7FXYq7FXYq7FXYq+If+c/8AWl038h/0d6nCTzBr9hahf5liElyw++IZru05VirvL6x/wGtL4vbvHW2PHI/Oo/75gH/Pt/R/q/kH8w9eK0Oqa9b2QbxWythIPxuTlfZMfRI+buf+DlquLX6bD/NxmX+nlX+8fo7m1fDnyN/znDrU2kf847eaooHKPrV5p2nOR3SS5WRx9KxnMHtGVYT50+k/8CbSxz+0GEn+CM5fERIH2l8X/wDOGf5Fw/m15V8xXHmnzZqUf5fWWuRrqX5fafI1tFqd3FAjrJezIQxjVXACDvvUZr9BpvFieI+m+Xe+p/8ABR9rj2JqsUdPhidTLGayyHEccSSKhE7cRI5/YX65aDoGieV9JstC8uaVa6Jo+nRiKy02ziWGGNR4KoAqepPUnc5vIxERQFB+bNZrM2syyzZ5mc5bmUjZKb5JxnYq7FXYq7FWmYKpZjRVFSfYYqBb+fz8m1Xz9/zlV5VvmBmj1fzvLrbHr8MVxJfV/wCEzmMH7zUA95v9L9me05/k32XzQ5cGnEPnEY/0v6BM6d+M0l8x+XtI82aDq/lnX7JNQ0bXLWSz1KzkGzxSqVb5EdQRuDuN8jOIkCDyLlaHW5tFnhnwy4ZwIlE9xH43734MeaNE87f84h/nzDNp0skj6Fci+8v3r1SLVNJnLLwkpsQ6co5APsuDToDnNzjLSZdun2h+wez9XovbjsIiY+scMx1x5B1HuNSj3jn1fuZ+Xfn3QPzN8maD538tT+tpeu24mWMkGSCUfDLBKB0eJwVYeI8M6LFlGSIkORfkntvsfP2RrMmkzipwNeRHSQ8pDcM1yx1T8lf+fkPmmebzJ+XXkyOWlpp+nXWsXEQOzTXUogjLDxVYGp/rHNJ2tP1Rj8X6P/4BvZ8Y6fU6ojeUowHuiOI/MyHyfoT/AM4+6JF5e/JD8qtLiUJ6flnT7iYDp611CtxMfpkkY5tNLHhxRHk+Le2erOq7a1eQ/wCqzA90Twj7AHsOXvMvzT/5+H/mK8Pl3y9+V2lM0s17KmveazECRDZxM0NmkpHQSzEsK90GantTL6RAe8vu/wDwFOxBLUZO0MmwiDjx31kfVMj+rGh/nF6V/wA+/LIW35DzXPEBtR8y6hKW8QkcEQ/FDlvZgrF8XQ/8GbLx9uiP83FAfbI/pfcWbF8mfhn/AM5s3Vx5q/5yW1LQ9P8A9JubS10nRbKEf7+ljWQJ9Lz5zvaB4s9DyD9bf8CnHHRezcc09gTkmfcDV/KL9n/IXlOx8ieS/K3k7TlC2nlvTLawRgKc2ijAeQ+7vVj7nN/igIRER0flvtjtKfaWsy6qfPJMy+Z2HwGzLcm61+NGqSnz5/z8Ht0r6sWmecLaNF6hRoFspYf8Fak5oJevWfH7n6h08f5N9gSeRlgP/S6R/RN+y+b9+XnnX5vaquh/lV+Y+rM/D6j5a1SRH8G+qyBT95GVZ5cOOR8i7v2a0/5jtTTY/wCdlh/ug/Nr/n23o5k8y/mdr7R7Wmm2NhFL73E0krj/AJIrmp7Jj6pF90/4OmprTaXD3zlL/SgAf7ov1qzdvzg/NL/nPPzTfeZdPufy80Gemn+QbCHzZ5/uBUor3NxFY6ZaEjo7md5aHtxOajtKZkOAdNz9wfd/+A/2fDSZBrcw9WeRw4h/ViZ5Z+4cIj77CZ/8+37IR/l5+YWo0+K68xRWxbxFvaRuB9HrZLskeiR82j/g5Zb7Q00O7ET/AKaRH+9fo1m1fD3xp/znjqo07/nHvV7UPwfW9Y02yTfrSU3BH3QnMDtKVYT5kPqH/Ag0/i9vwl/MhOX2cP8AvlL/AJwJ0s2H/OPunXRWh1rW9SvAfELItsP+TODs0Vh95LL/AIMOo8Tt+Uf5mOA+zi/3z7QzYPlrsVdirsVdirsVfit/z8M1z9IfnVo+kI9Y/L/lm1jdPCW5nnnY/SjJnP8Aakrygdwfqj/gK6Twuxp5TzyZZfKIjH77fqt+R+jDy/8Ak7+WOkUo1p5a031AdiHkt0kavvyY5utPHhxxHkH549rNV+a7X1WXvyz+yRH6HqeXPPOxV4N/zk/qo0b8gPzVvOfps+hy2iNWnxXjLbLT6ZMxtZKsMvc9h7Aaf8x29pI/7YD/AKW5fofKv/Pt3SzF5I/MfWSu19rdrZo//MLbFyP+S+YXZI9Mj5vof/Bz1HFrdNi/m45H/TSr/ev0jzbPhj8wv+fk2thNK/Kvy4j1Nzd6nqU8fh6EcEMZ+n1XzT9rS2iPe+/f8AvSXl1ec9BCI+JkT/uQ+hv+cJvI8fk78hPLl68Ij1DzpLNr189KMyzN6dtU+HoxoR88yuz8fBhHnu8T/wAFbtY67t3LEH04QMY+G8v9kT8ny5/zmV+cv50eQ/zJXyZ/iW50n8ttbtba/s00SNLK9uLNj6V3Ab6jyK4ZXFVIFCpK5h6/UZYT4b9J7v1voP8AwL/ZfsbtLs7814QnqoExPGTOEZc4S4NhVEc73Bovvv8AJjyD+Vvk/wAoaXqP5XaPb2uleZrODUP00SZry9SdBIr3FxIWkY/FupNFNaAZs9PixwjcBsXxz2p7Y7U12rnDtCZM8cjHh5RgQaqMRsPfzPe9fy95l+VH/PyPzTOb38tPJMUhW2jhvNbvYq/ad2W2tzT/ACQsv35pe1p7xj8X6I/4BnZ8eDVas87jAe76pfO4/J9xf84yaLHoP5BflVZRoE9fQLa/kp3e/Bu2J+mXNjo48OGPufJfb3VHU9vauZ6ZDH/Sej/evdcyXkX5z/8APwr8xmsPJejfllpZaW916ZNY8y+mC3oabayCOD1afZE1yy0J7pTvmq7Uy1EQHXc+59v/AOAt2GMusnr8m0cYMIX1ySFyrv4YXf8AWZF/z7w05bb8l9dvwPi1LzRdcj/xhtrZBk+yxWInzcH/AINefj7Zxw/m4o/bKRfe2bJ8edirsVdirsVdir8I/wDnOPVzrX/ORfmO1if1V0Wx03TIgN6EW6zMv/BzHOb7RleY+VP15/wJdN+X9nsUjtxynL/ZcP3RD9vPKWk/oHyr5Z0OnH9DaVZ2PHw+rwJF/wAa50UI8MQO4Pyh2lqfzOqy5v585S/0xJZBknCfhp5nv/8AlaP/ADm+kV45uLFvP1ppUSVqv1TSrhIKL7MsBanvnOzPi6r/ADvufrbQYf5H9irjtL8tKf8AnZImX++r4P3Lzon5Jdir8HP+c0fzFf8AMT85dRayLyeWvKkZ0HQrqh9KeS1cm9ljbo379mSoPRRnN9oZfEy+Q2fr/wD4FnYg7L7Hjx7Zcp8SQ6gSHoB/zQD7yX7deRrNdP8AJPk+wQcVstE0+BQPCO2jX+GdDjFRA8n5Q7Xy+Lrc0z/FkkfnIspybr34Q/8AOT0N3+Y3/OWPmLy3YGtzf6vpfl2zYDkFb0YLcmg7KzEnOb1l5NQQO8B+vfYCUOyvZXHnnyjCeQ/OUvufuPoGiaf5a0PR/L2lRCDTNDsoLCwhH7MNvGI0B96LvnRRiIgAdH5L1mryavPPPkNynIyPvkbKb5Jxn40flvJ/j/8A5z71HVgfXtLHzNrd0r9f3OmW88Fu33xx5oMX7zV35n7H6h7cj/JnsHHHyMsWMfHJKMpffJ+y+b9+XnyN/wA5ifkZqn5z/l5aSeV4xP5w8m3El9o9iSF+uQyoFuLZWNAHYKrJU0JXjtyqMHX6Y5obcw+k/wDAy9rcXYHaBGoNYcwEZH+aQfTL3DcHyN9Hzr/ziR/zkp5a/LnyvL+Tn5w3E/kjU/K93P8AoS91OCWKP0Z5Glktp6ryieOVmILChU0qOO+LodXHHHw8m1Pb/wDBI9hNT2rqR2p2YBmjlA4hEgmwKEo9JAxAut7Hm+kPOv8Azlx5Bt7Z9G/Kcz/m5+YGoqYtB8vaFbzXEImbZZLmdUCrGpNW4kmngKsMvJrocoeqXcHhuyv+Btr5y8XtGtJp47znkIia7oxuzI9L29/Ikn/ONH/OOWr+R9X1r83fzVuY9X/NvzfJPcToGEkemLdsXmVXGxlkrRivwqvwLtUmOk0hgTOe8j9jl+3ntxh7QxQ7N7OHBo8IAHQ5OHYbfzR0vcn1HpXs7M98tfht/wA5UapJ+Yn/ADljN5dkkL2djqWj+V7NCdlUtF6oHzmnc5zutPiaivcH61/4HunHZfsqM4HqlHJlP21/sYxfuLFFHBFFBCgjhhRUijXYKqigA+Qzon5MlIyJJ3JVMWL8VP8AnPn8xm83/mfY+V9PZ5NA8gQy6fJcrX0pNWl9OW9UN0LRIYUYdVNfHOf7Ty8eThHIfe/VP/Ac7DGh7MlqJ7ZNQRKuoxixD4SPER3j3P1I/wCcetPGl/kb+VFmBTj5Z0+U/OeFZT+L5udKKxR9wfn321zeN23q5f7bMfI1+h7Hl7zD8NNbQfmD/wA50PBJS4gm/MS3t5O4a20qZIz/AMkrbOdl+81X+d9z9a6Q/wAmexFjYjTE/wCdkBP+6m/cvOifkp3TFX4a/kjev+aP/OZ+n+Y7xvrC33mXVNbj5bj07WOea3H+wVEp8s53TnxdTfmS/WvtZiHY/sdLBHbhxQh8ZGIl87L9ys6J+SlrukaPJI6xxxqWkkY0VVG5JJ6AYpAJNDm/n6/PbzrJ+cP/ADkFeayqyHQtT1S00ryu0ilVl0yGYW0UyV6rMQ0g/wBbOY1OTxc19L29z9meyHZQ7C7Aji28SMJTn5ZCOIg+cdo/B/QJGgjjjjHSNQo+QFM6d+M5Gza/FDsVdirsVdirsVdirsVdirsVf//V+/mKuxV2KuxV2KuxV2KuxV2KuxV2KvzF/wCfk2tiPRfys8uK9Td3upalNH4fVo4YYyfn67UzT9rS2iPe++f8AvSXm1efujCP+mMif9yHuP8AzghpX6O/5x60W5KcH1nVtSvWP8wE3oKfuhGZPZsawjzJeS/4L+o8X2gnH+ZCEfs4v98+ycz3zB8c/wDOduk3Op/849a5PbRtJ+htV02/uAorSMS+ixPsPVBzA7SjeE+RD6d/wIdTHD7QYxL+OE4j31xf714L/wA+3fNVkdN/MjyRJKE1BLm11u0hJFZIXQ20zKP8hkjr/rDMbsmYqUfi9j/wc+zp+JptWB6alA+Rvij87l8n6gZuHwBJ9f8AMGieVdHv9f8AMeq22i6LpkRmvtSu5BHFGg8Se56ADcnYb5GUhEWTQcrR6LNrM0cOCBnORoRAsn8fYk/kPztpP5ieVdL846Fb31vo+siR9O/SNs9rNJEkjRrMIn34SBeaHupByOLIMkeIci5PbHZWXsvVT0uYxM4VfCRIA1dWOo5S7jYZhljrHYq7FWFfmTq/6A/Lzz1rfP020rQNSuo36UeK2kZfxAyvLLhgT5F2vYWm/M9oafF/PyQHzkH4v/8AOCWmDUf+ch9CuGUOuj6Vqd6a70PoGAH6DMM0HZovMPIF+pf+C9qPC9n8kf584R+3i/3r91c6N+RXYq+Wv+csPyJi/Or8u5jpVsp88+VFkvvKs1Byn2BnsifCZVHHwcKelcw9bpvGhtzHJ9B/4HPtefZ/tAeIf8Hy1HIO7+bP/N6/0b8n53/84Yfn7J+U/nSb8vvN9y9p5M823Yhc3FUXTNVqI0mYNTgklBHLXp8LH7JzVdn6nwpcMuR+wvtn/BS9jh21oxrdMLz4he3+Ux8yPMj6o9+46h+2udC/KT8Y/wDn4np89v8Am/5Z1Bwfq+oeWIVgbtWG5nDj/hhmg7VH7wHyfqP/AICWaMuyMsBzjlN/GMafqF+Q2v2fmb8mPyw1ixkWSKby3p8EvE1CT20CwTp80kjZfozcaaQliifJ8A9sNHPSdsarFMbjLM/CRMon4ggpr+aX5n+Vvyj8oaj5w81XYitrVSlhYIR9YvbpgfTtoF6s7n6FFWOwOSzZo4o8UnG9n+wNV23q46bTiyeZ/hhHrKXkPtOw3fmB/wA5FeXfMmmfkK35j+f4fQ/Mj86/OlhqGsWTV/3G6VbWV21hpqht1EScSw68jRt1zT6qEhi45fVI/IVsH372I1unzdu/kdEb02iwSjE/6pklOHiZP842B5cti+wf+cE4wn/OOvlxgBWXU9Vc/P606/wzO7N/uR8XzP8A4Lsr9ocvlCH+5D65tb6yvhObG8gvBazPb3JgkWT05o6c434k8WWu4O4zOBBfNsmGeOuOJFixYqweRHl5vxLso0/MT/nPCQFBdW48/wA7EdQ0OiMxr8uNrnPj95q/877n6syk9l+w3cfyw+eWv0zft9nQvyetd1jR5HNEjUsx8ABU4pAs0H4sf84j3C+b/wDnLrVPMlw3rPK3mHWInY1q07OgI+ibOf0J49RfvL9T/wDBJgdD7JwwR2rwofKj/vX7D3vm/wAradr+k+Vb7zBp9r5l11ZX0jQZJ0W7uFhQySNHDXkQqgmtM3pyRBESdy/MuLs3VZcE9RDHI4oVxTo8MbNCzy5vHf8AnKy8ax/5x5/NSZesmkfV/ouJo4j+D5RrTWGXuem/4HeLxPaDSDunf+lBP6Hyz/z7bihHlD8zpwwNw+sWKSL3CJbuUJ9iWbMPsn6Ze99C/wCDpI/m9KOnBL/dD9j7Q/Oj83vLv5L+Sr7zTrciz30gNv5b0JW/f6jfMP3cMaippXd2A+Fd+tAc/UZ44Y8R+D5b7LezWo7f1sdPi2jznLpCHWR/QOpfB/5seSde8m/84lee/N3nljJ+Zf5v67petec3cUaD1LlXtbEDei28Qpx/ZJZRsBmtz4zDTmUvqkQT+p9e9nO1cGv9q9PptJtpdJjnDH51Eic/fOXXqAD1ek/8+6EC/k75salC/m+4JPjSxshl3ZX92ff+gOi/4Nx/13w/8JH+7m+94L6xup7u2tryC4ubBlS+t4pFd4WdeSrIoJKkjcA9s2QIL49PDOERKUSBLkSNj7u9+d3/AD8g1Uw/l9+XuiBqDUfMM16y+P1O1eP8PrOavtaXoiPN9s/4Bun4u0NTl/m4xH/TSB/3j6I/5xBsksf+ccfywiQU9Wyurhj4m4vriU/8SzK0IrDH8dXif+CXlOT2i1RPSUR8oRH6H0TZ31lqMAutPvIL62LOguLeRZYy0bFHXkhIqrAgjsRTMoEHk8TlxTxS4ZxMT3EUd9xz7xuisLW7FXYq7FXYq/Af/nK6+m82/wDOTXnm0iYO41Oy0a2p4wwQ29P+CrnM608Wc/J+yP8AgdYhovZvBI/zJTPxMpfc/e6wtItPsbOwgHGCygjt4V8EjUKo+4Z0oFCn47zZDlnKZ5yJPzRWFrdir43/AOc8NVOnf848a5ahuP6c1bS7E+4WcXVP+nfMDtKVYT5kPp//AAINP4vtBjl/MhOX2cP++SL/AJ982aW35D3dwB8WoeaNQmc/6sNtEP8Ak3keyxWL4uZ/waMpn24I/wA3DAfbI/pfbdtfWV410lneQXT2Mxt71IZFcwzABjHIFJ4sAwNDvQjNgCC+UTwzxgGUSOIWLFWO8d48345/8/ENWbUvzf8AKegQ1d9J8uw0iH+/by5mO3uQq5ou1JXkA8n6d/4Cmm8LsjNmP8eU/KMR+sv1t8j6LF5c8l+UfL8KenFoei2FhGnSgt7dI6f8Lm7xx4Ygdwfm7tbVHVazNmPOc5S/00iXyb/znX+Vbee/ylPmvTbb1te/LmVtRHEVeTTpQEvEHf4QFl+SHxzC7Sw8ePiHOP3Po3/Ai9oR2d2r+WyGseoHD7pjeB+O8f8AODzX/n3/APnTFq/l69/JzXbwDVvLvqX3lEytvPYSNynt1qdzBIxYD+VttkynszUXHwzzHJ33/Bl9lTg1Ee1MMfRkqOSukx9Mv84be8d8n3lrP5h+StA8zeXfJur+YrS080+a5Hj0HQyxa4mKIzliiA8FopAZ6AnYGubKWWMZCJO5fH9L2LrdTpsmqx4pHFi+qX8Is1zPM+Qsjm/Kv/n49ZTx/mV5D1FlP1W78tNbwuehkgvJmcD5CVfvzTdqj1xPk/Q//AOyxPZuoh1GW/gYiv8Acl+jH/ONuvWfmP8AIf8AKq/s5EkS28u2WmzhSDxm0+MWkqnwIaI5tdJISxRPk+Ie3Wjnpe3NXCQ55ZSHumeMfZJmf5k/mP5W/KrylqfnHzbfrZ6dp6H0YAR611OQfTt4EJHORyKAdupoATlmXLHFHik6vsLsPVds6uGl00blLr0iOspHoB+wbvzE/PvRfMg/IHzB+b35gWxs/Pf51+aNK4aU9a6VodtHPNp+nqGAKnjGJH2FSRyHIHNPqYy8E5Jc5EfAdA++ex2q0/8AL2PszRG9PosU/V/qmaRjHJk+3hj3C62L6g/5wDQJ/wA4/wBuwFPV8wakx9/7pf4Zmdmf3PxLwH/BkN9vHyxw/S+zba+srxrlbO8gu2spjb3iwyLIYZlALRyBSeLAEEg775nggvl2TFPHRlEjiFixVjvHePNFYWt2KuxV2KuxV/P754lXz9/zlpq8QHqw6x+YsenU6gwxX6WtfccEzmMnr1B85fpfszsmP8m+ykDyMNMZfEwMvvL+gLOnfjN2KvwH0K9j8if85gx3WtuLeDR/zJuI9Qmk6JHJqEkZkJPYK/KvhnMxPBqd+kv0v2PrMR7S9kTHFuZ6UV7xAGvsp+/GdM/HD5k/5yA/Nq/0Qab+Un5cSrf/AJw/mKfqOi20TV/RNpKCJtSuSK+msacmSvcctwpzD1Wcx9EPql9nm977GezmPUcXaWuHDotP6pE/5SQ+nFHvs0D8uZfl3/zlz5R0r8vvzC8g/lzovxad5S8o6bbPOwo9xcz3VzNc3EnX4pncufnmn10BjnGA6AP0B/wNu0svafZ+o12X6suaZr+bERjGMR5RAoP3Hsp7XTtBsri7uIrOzs7GJp7mZxHFGiRirM7EAAAdTnRDYPyXlhLLnlGIJkZGgNyTfcmsUsc0cc0MiywyqHilQhlZWFQykbEEdDknHlExJBFEPxI/JNP+Vh/85uPrLkzW48067raydQI7X6zJbk/SEGc9p/3mqvzJfq72rP8AJfsX4XI+Dih8ZcIl+l+3WdC/KCX6tfJpelanqchAj060muXJ6UhQua/dgkaFt2mwnNljjH8RA+Zp+On/ADgLCde/PvzT5iuCPXh0HULwgncvd3UCsR/wRzQ9merMT5P05/wY5fluwsWCPI5Ix+EYy/U/XqTzb5Yi8yW3k+TX7BfNV5bSXlt5e9dPrbQRU5yejXkFFRuR+o5vOOPFw3u/NUezdTLTnVDHLwgQDOjw2eQvkmOr6lBo2lanq9yrvbaVaTXlwkYq5SCMyMFHc0XbJSNC2jTYJZ8sMUeciIj3k0/Nr/nFTU/JX/OQ/nz82/PP5n6dpfmPzxfSW0eieXNTijuIbLRV5cVtYZVIPBgquwFRsTTma6nRGOonKU6J7vJ90/4Imn1vsvodHpOz5Tx4Ig8U4kxM8v8ASI7xZA5f6Xb6L6F5W8s+WIWt/Lfl7TdAgcUeLTrWK2VgPERKtfpzaxhGPIU+I6vtDU6w8WfJLIf6UjL7yn2ScN2KvwM/O26Pk7/nLnzJrOpIUh0nztZazICOsAlgu1P0oc5rUHg1BJ77fsX2Ux/nvZPFix854JQ+NSh9797oJ4bmGG5t5Vnt7hFkgmQhldHFVZSNiCDUZ0oNvx5OBhIxkKI2LwX8+vzlX8tNFs9B8tRLrf5q+dpBpvkDyvFSSV7mY+mLqZP2YYiaknZiOPTkRi6nUeGKG8jyD2Hsf7LntbNLNnPBpMPqyzOw4Rvwg/zpeXIb9wPy3/5y/wDI6fljafk75Fkuv0lrNvo+o635r1lql77VtVula8uGY7mrw8Vr+yBmn12PwxGPWiT7y/QX/A07WPa89brAOGBnCGOPSGPHH0R+UrPmS/YP8p/Ttvym/LX1GWKK38paN6jsQFVVsIaknoAKZvcG2OPuH3PzN7R3PtXVVuTmyf7ss8tbu1vraC8srmK8tLlBJbXUDrJHIjbhkdSQQfEHLAbdPkxyxyMZgiQ5g7Ee8Pw9/wCcbqa3/wA5k2F/O3Nm1/zDfVPdjDeEf8SrnPaTfU35n9L9Ze3X+D+x8oD/AFPFH7YP3Kzon5KQ/OG7huEgnSSheGR42DcHFVZTToVPUYObOjAgkdx+D8Fv+cTtSj8mf85N+ToNYItpDf6hok/M8QlzcwTWqKSabmQhfnnN6I8GcX7n7C/4I2A6/wBmsxxb+mMx/ViRI/7Hd++OdK/HT5I/Pr8wNQ82a1Y/844/lpe+p5186rw876zbnkugaEafW5ZWX7MssZ4ovWjdiyZg6nKZHwoczz8g+kex/Y2PRYZdua+P7jD/AHUT/ls38AH9GJ3J8u4SfnJ+dumaTov/ADlh5d8paJbLa6L5S1Dynoem2oNQkNtHaAAnuTyJY9ySc1WoAGoERyFD7n3H2Uz5dR7K5NTlNzyxz5JHzkZ/geT9yL2+stNtpLzUbyCws4aerd3MixRryIUcncgCpIG5zoiQOb8lYsM8shGETKR6AWfkEVha3Yq7FXYq7FXYq7FXYq7FXYq//9b7+Yq7FXYq7FXYq7FXYq7FXYq7FXzv+bfmj/nI3R/MFlafk/8AlxoPmvy+1isl/qmr3iwSC7Mjgxon1uA8VQKalTUnrmLnnmB/dxBHm9t7N9n+z2fTyl2nqcmLJxbRhGxw0NyeCW931fCH55/k1/zl1+feuaNrXmf8uNG0o6FZNZWNlpup2ixUeQyO7eteSMWY0HWlAM1up0+ozkExG3n+19e9kfaj2T9m8E8Wn1M58cuImUJXsKA2gNv1vU/yms/+c1/yk8kaZ5D0r8qPK+s6Vo7zGwub/UYBOqTyNKyMYb+NSAzGnw1y7ANVijwiIIHn+1572jy+xnbetnrMmrywnOrEYGthV7wJ5AdX3B+V2pfmRq3lOC9/NXQNN8s+bZLmdZtI0uX1oI4FakLF/WnBZgKmjeHTNjhMzH1ii+T+0GDs7DqjDs7JLLhoeqYok9dqjsPcyXzV5Z0jzn5b1zypr1v9a0fzDZTWOoQ9CY5lKkqd6MtaqexAOTnATiYnkXA7O1+XQanHqcJqeOQkPeP0d/k/E3zB+S/5+/8AOLX5ixebPJum3+sWGmTOdG81aZbPd2t1ayVBgvYYuRTkuzo4ArujbBs56WnzaafFHfzfqzRe1PYPtj2edNqpRhKQ9WOREZRkP4oSPOjyI90h0fVnlr/nMz88fNsMek6B/wA423eq+ZJF4G9ilvI7FX6c3jkthwWvZpx/rZmw1+WWwx7vnev/AOBd2JopHJm7TjDF3ERM67gRLc+6HwereWvyH/MX80NZsPOf/OTuvW+qwadILnQfyi0k8dGtJAah7ziSJ2HhVh4uy/Dl0NNPIeLMfh0ed1/th2f2PhlpewMZgZCp6if97Id0P5g89vKIO77MjjjhjjiijWKKJQkUSAKqqooAANgAM2D5dKRkbO5K/FDsVdir8/PzLvf+c1PP3ljzZ5KT8pPK+l6L5khnsDfw6lCbtbORiNi9+UDsmxPHvsBmszHVZImPCKPn+19m7BxexvZmpw6o6zLKeMiVGB4eIe6F0D5vnD8m/wDnH7/nLT8kvOSedfLH5faTf331OewnstQ1KyeCSGfiWB9O7jcEMikEN28MxMGl1GGXEIj5vc+0/tn7Ke0Gj/K6jUzjHiEgYwnYI98CORI5P0W/KDzD/wA5B63qWsJ+cnkTQPJ+lW9tG2jy6TdfWJZ7hno6tS6uAFVR3A3Iza4JZpE+IAA+I+02i7A0+OB7L1GTNMk8XHHhAjW38MdyXvmZLxzsVflp/wA5T/8AOGvm/wA1+f5PPH5RaPbX1v5nDTeZtGNzBaGC/H27iP13RSs4+JgDUPyPRttNrNBKU+KA5836D/4Hv/BQ0mi0A0naUzE4toSoyuHSJ4QTceQ/o0OjOfy+vf8AnPHyJ5Y03ytN+Xnl3zZb6TEtvYanrGowNdrCgpHHJJDfx+oEGwLDlTqTlmI6uEeHhB95/a6ntrF7Ddo6mWoGpy4jM2YwgeG+pAMDV+W3k9H/AOctfyF1z87Py50PUtHtYG/MbychubfT0YKl2k8afXLSN2NK8kDR8jSopX4q5drtMc0AR9QdF/wN/bDB7P8AaOSGUn8tm2J/m0TwTI9xIlXffSn5yflX+ZX/ADlB+S7Xnkbyj5d1opc3TH/C2o6NcXQhuWPFmhQoGQsRvQ8T1p3zVYcufD6Yg+6n3D2h7C9me3xHV6nJj2H1xyRjcf6RujXTr0fdP5PfkD+Znn7zZp35w/8AOT2pSatq2lMJvJ3kCYp9XsnqHWaeCL9zHxNCsaipIBkNRxzY4NNOcvEzc+gfI/ab2y7N7N0suzOwIiEJbZMovin0qMj6jfWR2raI3tEf8/BfLGv+Yfyr8qXGhaXdat+ifMsb31vZxPNIqT208aSFEBNOZC1p1YYe1IGWMVvuw/4DHaGDS9qZhmmIceI0SQBYlEkWfLf4PGf+cffyX/5yl1TyJH5Iv/M91+T35X3V3LeTn0kTXZ0uAPVitwKSwo/Wrsm5JowNMx9Lp85hwk8Mfteo9tPan2Yw646uGIazVACI3Pggx5GX8MiPIS94L9Ffy0/K/wAo/lD5X/wz5MsJYrVpXvL65uJTNc3t26gPPPK3V2CgbAAdgM2uHDHFGoviXb3tBq+3NT+Y1UgTVAAVGEekYjuF+ZfBH/ONP/ONn5ueTvz8ufzJ/MPy7DpmmiLVrq3vFvbW5Zry/JjA4QyuwqkrmtM1mk0mSGbjkO99h9u/brsnXdhDQ6LIZSvGCOGUfTDfmQBziH6e5uHwJCX8D3Vje20bcJLiCSJH8C6lQfxwEWGzDMQnGR6EF+Jn5Mf84uf85N2Pnc6p5fguPyun0eW4s5fOGoERD03DRS/V4SGedXUkqQvE7HkDQ5z+n0ecSsemur9We1P/AAQPZrJovDzEaoTAl4cd9+Y4pbCNHnvfk/Tr8pf+ccvJ35Y30vmm9u7zz5+Y98CdS8/685uLws4If6uHL+ipBI2JamxYjNvg0kcZ4ucu8vgftH7cazteA08BHBpo/Tix+mPlxVXF9gvcB6B+bXkk/mP+WvnXyQkqwT+Y9KntbKd/sJcU5wM3sJFWvtlufH4kDHvDpvZvtX+Su0sGrIsY5gkf0eUvst+JH5a6x/zkf/zj95v1rR/KXlXV7TW9S42Oq6BcaXLewXDRsfSkVVUhipY8XRqEHqQc57DLNgkREG/c/V3bum9nfabSQy6nNA44+qMxMQMb5jy84kcx3vv78l/yA/Mjzv5xsPzr/wCcmb99U1/TSJfJvkefgYbE15pNNDH+6i4GhSJRXl8Uh5CmbPT6ac5eJm59A+Ne1Ptl2d2fo5dldgx4cctsmUXc+hAkfVK+sj02jsbeif8AOb3l/WfMP5A65BolhPqVzp+pade3FpbI0sphSbg7Kigk8eYJoOm+W9oxMsJp0n/An1uHS9vYzlkIiUJxBJoWRY386fHP/OM35Uf85Vv5Z1Py5oGqzflD+X/mW7S+1HXb+2CakWMaxu1hC1JlLoqgseA2HFuuYGkwajhoHhifn8H07289o/ZYamGfNAavUY48IjE/u+djxD9Jok7erzD9Jfyk/Jnyj+TmkXth5cN5f6nrMiXHmXzLqUzXF7qNwgIEkznYU5GgUACvc75tsGnjhFDrzL4Z7Se1Gr7dyxnn4YwgKhCIqEI9wHy3L42/5+I+VPM3mHSfysutB0a+1qC0v9RtbiGxgkuGSa6jgMIKxhj8YiYDbtmB2pCUhGhfN9P/AOAn2jptLl1cc04wJjAjiIjtEyvn3cQSj8l/yO/5yZ81fl/oXkPz95xu/wArPys0xZVTQrJY49evbeeRpWgkkT4oY+TEUkaoBoYyKYNPp88oCMjwx+1yfan2t9m9Hr8ms0eGOq1cq9UrOGMgAOIA7SO38Iq9xIF+hHkHyD5W/LPyvp/k/wAnad+jNE04MYoS7SO8jmsksjuSWdzuT91BmzxYo448MeT4v2x2zqu19TLU6qXFkl8BQ5AAcgOjMssdW7FXYq7FXxrq/nr/AJzTj1bVI9F/JfyjPo8d3Oukz3GpJ6z2wkYQtJTUFHIpQnYb9swJZNVe0BXv/a+oabsj2NOKBy67MJ8I4gIGuKt6/dna+T4N1r/nFL/nKrXfOupefrvyZZJr+p6xJrcjx6np/ppcvOZwEVrg/CrbAEnbNbLRaiUuKt7vmH2DS/8ABE9l9Noo6OOeXhxgIfRO+EDh39PMh9wQ+e/+c5wIkm/JbyUx+FZJv0ioHgWoNRPz2zYeJqv5g+f7XyaXZHsRuRrs/wDpP+rb7Yi9X0o/X4mbgvrFKheVPi41qaV6ZsXyqVWa5KmLF8T/APOe3l7XPMH5IWo0PT7nVG0zzHY3d/a2sTSyCExTwiTigJIDyqNh3zX9pRMsW3e+rf8AAe1uDTdtHxpCPFikASaF3GVb+QPyfN3/ADjl+UH/ADlVe+SpvJsev3H5O/lpq162oXd/PAqa3IJ40SVLNNpoldUBqxTfda1IOJpMGoMeG+GP2vc+3HtN7L49aNUcY1mqhHhAB/dCiSDM/TIgnoJdxp+jn5V/lJ5P/J7y9J5f8pW89L2Y3es6tezNPd310wo088hoCx8FAA8M2uHBHEKi+H+0PtJq+3dQM2pI2FRjEVGEf5sR3e+y+DPzw/5xu/OD8zP+clo/Olt5chk8gpqGiQjVXvrVWFjapB9Zf0GlEmzeptxqe3XNbqNJkyZ+KvTs+v8Asn7c9kdkezZ0sspGo4ch4eGX1yMuEcVVy4d7fqBm4fAVC6tbe9trizvIEubS7ieG6tpAGSSORSroynYggkEYCLZ48kschKJog2COhHIvxY8y/wDOIP51+VPzul078qLG+t9GS7/SPlPz5FcNawWNtIxISa6BDLJDUoVFWYCoUhs0E9DljlqHLoX6n0H/AAS+xtb2KJ9oyiZ1w5MRHEZyHdDrGXMHYA7Egh+j/wCSf/OOui/lbPc+bPMOrXHn/wDNPWU/3OeetUZppV5j44rX1S7InYsTyYdaD4RtdPpRi9RNyPV8O9q/bfN2xEabDAYNJD6cUdh5GdUCfLkPfux//nLr8iLz87fy/tv8OpG/nTyhNJe+X4pCqC5jlULcWnNqBTIFVlJNOSgGgNRHXaY5obcw5n/A19r4ez+vPj34GYCM/wCiR9M661ZB8iX5h/lf+YP/ADk7+RtzqHk3yp5d1qIXdyTN5V1DR57qNLk0QyRRlAys1ACVND3rmnw5c+H0xB91PvvtB2L7Ne0UY6rU5MZof3kcgieHnRN7j3iw+4/ym/IT81PzQ81aX+bP/OUOoy3r6Q4n8pflzNwWCB68lluLaP8AdRgGh9OnJiB6h24nY4NNkyyE83TkHyb2j9sey+x9LPs32fiI8e2TMLsjujI+o/1uQ/g52yb/AJz98ta55i/JbSDoenXOpvo/mmzvL63tY2lkELW11bhuCAkgSTIOnfJ9pwMsQroXX/8AAb12DS9sz8aQjx4ZRBJoXxRlzPlEvnv/AJx0/J3/AJypvvJMnk3/ABDcfk7+WeqXj391dzQqmtyiZESVLRNpolcKDVmTfcVqQcXS4NQY8N8Mfte19t/af2Xx60arwxrNVGPCAD+6FEkGZ+mRHcBLuNP0b/Kz8p/J/wCT/l1vLnlC2nWO6nN3q+p3krT3d9dsAHuJ5G2LEAbKAB2GbXDgjijUXw/2h9o9X25qPH1JFgVGIFRhHpGI7vfZel5c6F2KuxVZKzpHI8cZldVJSIEAsQNhU7CuKYgEgHZ8Uzeff+c4y8wg/JPyYI+TCBm1JSQtTxJ/3Iippmv8XVfzB8/2vqsex/Ymheuz+fo/6tvhrRv+cUf+cqtD856f58tPJtlJr+nasmtRSTanp7RvcpN6/wAa/WBVWbqK9M10dFqIy4q3u+YfWtV/wRfZfUaOWjlnl4cocG0J3w1w7ennT7y0nzv/AM5r3GqaZb6t+Tvkyx0ye6gj1O/TUA5hgaRRLIEGosSVUk0AP05so5NVe8R+Pi+Qansn2MjinLHrc8pAHhHBzNbC/D6l9mZnvlz8nP8AnNj/AJxn813fm26/NzyDotxr2n63HGfNulWEZluba6hQJ9ZWFKs8ciKORUEqwJOzVzSdoaSRlxxF3zfoz/gU+3mlhpB2brJjHKBPhykajKJN8NnYEE7XzGw5MA/Lr87P+c09e0yy/L3yhp2oanNBELO31290kfWbaIfApmvblViHAbcpan3JyvFqNTIcMfudz237KexumyS1uplGIJ4jGOT0yPPaETxb90dn6Cf849f849/8qrTU/OPnTV285fm35sHPzL5puHaYwoxDG2t5JPjK1A5uaFiBsFAGbPS6XwvVI3I8y+M+2vtp/LJjpdLDwdHi+iAoX/SkBtfcOnmSS+Dv+c2/y18/eZ/+cgbR/LPlTVdfGu6HYjTHsLaSZS0BkjkUugKqVIqakUBBzW9oYZyzbAmw+v8A/Ao7d0Gk7AkM+aGPgyS4uIgc6I2PO/LufTXlP/nHz85fzT07Qz/zkt57uE8taXBAkH5X6JIsEdwYUCq2p3FvRXY03CljXo65mQ0uXKB4x27h+l4LtH207H7GyZP5B048WRN55izGz/koy5DuuvMF9sNp40Ty02l+WbFIBpOmm10DTYyERPQh4W8SljQAcVUVObCuGNB8pGb8xqfE1Er453OXvNyP3l+df/OHv/ONf5pfll+aOtedPzF0CLSbVtEuLXTpFvLa6Zrm6nhZtoJJCKIjbnbfNVodJkx5DKY6Pt3/AATfbrsztfsyGl0OQzPiAn0yj6Yg/wA4DqQ/THNu+DMa856Vda75P816JYtxvdY0e+sbNiaAS3Fu8ab9t2GQyR4okDqHP7L1EdPq8OWf0wnGR90ZAl+Of5Cf84w/85N2/mSXWNFku/ybiaGXTtR8x6hSO5a3l/vUgtRWRz8IKt8K1oVcHNFptHn4rHp836c9sfb/ANmpaYYsojrDYkIR3jxDkZS5DzG56GL9O/yj/wCce/Iv5SPPrFmLnzP541IE61591pzc6jcM4HMK7V9JW7hdz+0zZt8Glhi35nvPN8D9pPbTXdtgYpViwR+nFD0wj3bfxH3/AAAe5yRpKjxSoskcilZI2FQykUIIPUEZkvIgkGxzD8Rf+chvym8u/kf5yk88fk3+a+lWc0F39Yg8p2mpomtaXJIxqsAiYmSEbijUYL8JDCpzntVgjhlxY5D3XuH6v9ivaPUe0Oj/ACnamjmQRRyGBOLIB/OsemXu2J3Fcme/ln/z8O846LFb6d+ZvlqDzfaxgI2u6cy2V/QCnKSKhgkPy9P55Zh7UkNpi3T9vf8AAU0eoJnoMpwk/wAMvVD4H6o/7J+gn5Wf85L/AJQfm60Nl5Y8zJaa9KP+UZ1Rfql8T4Rq5KS/882b3pm0w6vHl5HfufGPaH2D7X7DBlqMV4x/HD1Q+PWP+cA98zJeOfmj/wA5wf8AONfmTzlqdr+bH5f6VJrWoxWiWfm7Q7VedzIkFRDdwxjeQqnwOo3oFIFA2ajtHSSmeOIvvfd/+BN7dabQYz2drZiETIyxyP0gn6oE9LO4PKyb6PnP8rfzq/5zB03SbH8tvJWjaprAs0+qaUL7RmmuLKIDiqfWJ1VUSMdPVJCjwAzFw6jUgcEQT8HuPaD2V9kcuWWv1c4QveXDkqMz38MSSSf6O5977/8A+cfP+cd9Z8m6tefmp+butt5z/OHXYysl9NJ68elwuKNDA52LkHiWUBVX4EHGpbZ6XSmB45m5H7Hxr209tsOvxR7O7Nx+DooHkBRyHvkO7qAdyfVLeq8sf8/AfIXnLzL+Zn5eXnlzy3qWvw6hoLabbJp9rLcn6zDdyyMh9NWoSs6kV9/A5hdp4pSnGhez6F/wGe2NHpOzdTHPljjMcnEeKQj6TEC9/OJenfl1+QP5+/mL5R8seXPz189XflT8vNBsbeyt/wAvtGeOK/vre3ULEmo3ENQFCAKVJc0HRW3y7Fps2SIGQ1EdB+l0Hbftl2D2Xq8ufsjTjLqckjI5p2YQlLmccT5736R5kbPvny35c0XyjoWl+WfLtgmmaHotuttpthGWZYol6CrEsfEkmpzZwgIAAcg+O67XZtdnnnzy4skzcj3l+F2veVfzb/5x1/P648x6V5Uvr270bW7q+8v3Ys57iy1GyuWkUAPEPiEkUhVgG5KfAjOclDJp81gcj83640faPZPtT2CMGTNGInjjGY4hGcJxroe6QsbUR5Pu3RPN3/OX359W8VlZeXLP8g/KF2ANR81zxytqrxN9oWcU5EgJHRgiU/35XNlGepz9OAd/V8h1fZvsl7NyM55Za/MOWMEeHf8ATMdvhxS/qvrz8sPy08v/AJUeU7fyp5ee6uoRNJeanql/M091e3s9DPczO37UhAqAABmdhwjFHhD5p2/29qO2tUdTnoGhGMYiowgPpjEdwflV/wA5cf8AOM/nXyr+YOrfmZ5A0W+1fyt5iuzqty+lRvJcaXqDtzm5JCOao0n7xHAoCeJoQK6XXaSUZmcRsfsfoj/gbe3mi1mghoNZOMMuMcA4yBHJDkNztYHpMetX7hvkj84P+c3/AMzrG38k+Wba7RmRba685XOmLZywx9DJNfTIEVgBuyr6h7VbDjz6rIOEfOv0tPa3sz7FdkTOrzkd4xifECe6OMGz7ieHv2foX+QX5C6R+SmhXjTXz+ZfPfmRhc+cvOFxyea6mqW9ONnq4iViSKmrH4m3oBtNNphhHeTzL4r7Ze2GX2gzxqPh6fHtjxjlEd5rbiPlsBsPP5j/APOSH5W/mrrX/OUvm2XyZ5S1bVNRv7vT9V0G+s4GMQVLaBUlM7ARIEkjIJZgARvmo1eHIc54QX3z2G9oOy9P7MYRqs0IxiJwmJHf6pWOH6jYPQb2+3/L3/OOn5h/mbeaf5k/5yh86t5ljs2SbT/yu0hvq+jwyLSjXRh4CZttwvy5su2bGOlnkN5jfkOT5Prfbfs/siEsHs/g8MnY55+rKR/Q4r4R7/8ASg7vtdESJEjjUJHGoVEHQACgAzYPlRJJsrsUOxV2KuxV2KuxV2KuxV2Kv//X+/mKuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxVivnfzn5f/AC98q615y80Xn1HQ9BtzcXswHJ23CpHGv7TyOQqjuSMhkyDHEylyDseyey9R2pqoaXTx4smQ0P0k9wA3J7n53+T9R/N//nNfWtYvr3X738sfyH0i6No+laQ/C71FwA31d5/92NwIMhYemtQAjHfNXjOTWEknhgO7q+19p4Oyf+B/hhCGOOp7QmL4pi4w/pCPQX9IHqNEmQD7R8kf847/AJMfl9BFH5e/L/SjdRAV1fUIFvr1iP2jPch2BP8Ak0Htmfj0uLHyiHy3tb227Y7TkTm1E6P8MTwR/wBLGh87T3zr+Tf5XfmJZiz83+R9J1YInpwXZt1iuYVoQBFcRcJUAr0DUyWTBjyD1AOH2V7Udp9lz4tNnnDvF3E++JuJ+T8wP+ck/wDnC+X8rtJvfzJ/K7VLu98uaMy3OraLcvW906MMP9IgnQKZI4zQmo5oPiqwBI0+r7P8IccOQ+x9/wDYX/gpDtjLHQ9oQjHLPaMh9Ez/ADZRPKR6fwnlQ2v1T/zhF+e+ufmt5Q1nyv5wu31LzR5HMATWJTWW8sLgMsTTH9qSNkKsx3YcSatUnN7O1JyxIlzD55/wV/ZDB2Lq4ajTDhxZ79I5RnHnX9Eg2B036U+4s2L5K7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FX/0Pv5irsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVdirsVfAX/AD8Sn1WL8n/LcNpzGl3PmaBdXK9Dxtp2hVvbkCfmBms7VJ8Me99k/wCAlDEe18pl9YxHh/00eL7Hon/OD1/o95/zjv5Ug0t4zcabd6jb61EpHNLs3Ukp507tHIjCvYjLeziDhFebpP8Ags4c2P2gzHJdSEDH+rwgbfEEe+31zmc+bOxV4T/zkp520PyN+Svn7UNbniU6ppN1pOk2UhHK6u76JoYokXqacuTU6KCe2Y2ryCGKRPdT1/sJ2Vn7R7Z08MQPpnGcj/NjAiRJ+4d5ID5K/wCfdX5eavpOgec/zF1K3ktLLzQ9vpugCQcfXhtC7zTqD1Uu4QHuVbwzC7KxEAzPV9H/AODb23iz58GhxkGWK5T8jKhGPvoWfeH6V5tnwl2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2Kv/9H7+Yq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FXYq7FWHefvInlr8y/Ker+S/Ntl9e0TWYgk6KeMkbqQ0c0T78XjYBlPj1qKjK8uOOSJjLkXZ9jdsansnVQ1Wmlw5IHbuPeCOoI2L869I/5xs/5yV/5x08x6hrX5F+Y9P85+Xb81vPL98y273MaV4Lc20zLGXUGgkilDfIGmauOkz6eV4zYfbtT7dezntTp44u18UsOSPKcd+E9eGQuVHrGUSPed3uWn/85Af85FWUaweZv+cU9Yub1f7y40jUozCT7KYpv+JnMgarMOeM/AvI5vYz2eyG9P2vAR7pwN/fH/cphN+a/wDzlP5mU23lL/nHa08ovIhC6t5p1qKSOMnYMYIRC5p1ph8fPL6YV7y0x9nPZfSerU9pHL/RxYyCf848QSCx/wCcUfNH5jeY7Lzl/wA5LfmAfPVzYtz0/wAj6Qr2uj2wJB9PlSNmU0AbiilqfE7ZEaKWSXFmlfkOTm5v+CLpuytPLS9g6fwBLnlnUssvPqL7rJA6RD7XsLCx0qxtNN0yzh0/TrCJILKxt0WOKKKMcVREUAKABQAZsAABQfKc2aeaZyZJGUpGySbJJ6kovC1uxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV//S+/mKuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV2KuxV//2Q==',
          format:'JPEG'
        }        
      }
      
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
      item_key = typeof item_key !== 'undefined' ? item_key : 'default';
      var item = this.item(item_key,item_attr);      
      //set style
      this.doc.setFontSize(item.size);
      this.doc.setFontStyle(item.style);
      this.doc.setTextColor(item.color.r,item.color.g,item.color.b);
      
      // check for multiple lines
      var lines = this.doc.splitTextToSize(s, this.convert2pt(item.w/1.3));
      this.doc.text(item.x,item.y + this.convert2mm(item.size),lines);            
      
      // return the vertical offset
      return lines.length * this.convert2mm(item.size) * this.defaults.lineHeight + item.margin.bottom;

    },
    addLine : function(item_key,item_attr){
      var item = this.item(item_key,item_attr); 
      this.doc.setLineWidth(this.convert2mm(item.h)); 
      this.doc.setDrawColor(item.color.r,item.color.g,item.color.b);
      this.doc.line(item.x,item.y,item.x+item.w,item.y);
    },
    addImage : function(image_key,item_key,image_attr,item_attr){
      image_attr = typeof image_attr !== 'undefined' ? image_attr : {};
      
      var item = this.item(item_key,item_attr);            
      
      var image = this.defaults.images[image_key];      
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
      
      var destinationCanvas = document.createElement("canvas");
      destinationCanvas.width = srcCanvas.width;
      destinationCanvas.height = srcCanvas.height;

      var destContext = destinationCanvas.getContext('2d');

      //create a rectangle with the desired color
      destContext.fillStyle = "#FFFFFF";
      destContext.fillRect(0,0,srcCanvas.width,srcCanvas.height);

      //draw the original canvas onto the destination canvas
      destContext.drawImage(srcCanvas, 0, 0);
      
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
    
    addCriteriaTitle : function(s){},    

  });
  

  function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
}

  function rgbToHex(rgb) {
      return "#" + componentToHex(rgb.r) + componentToHex(rgb.g) + componentToHex(rgb.b);
  }  
//});

