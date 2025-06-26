$(document).ready(function(){

    $('#categories').on('click', '.btn-categories', function(){

        if (this.id == 'all') {
            $('#parent > div').fadeIn(450);
        } else {
            var $el = $('.' + this.id).fadeIn(450);
            $('#parent > div').not($el).hide();
        }
 
        $("#categories .btn-categories").removeClass("active");
        $(this).addClass('active');

    });

 
    function searchProducts () {        
        $("#categories .btn-categories").removeClass("active"); // Deactivate category buttons
        $("#all").addClass("active"); // Highlight "All" category during search
        var searchText = $("#search").val();
        var matcher = new RegExp(searchText, 'gi');

        // Target the product-card elements. The .box class is on the product-card itself.
        // The product-card is wrapped in a div like <div class="col-lg-2...">
        $('#parent > div').each(function() {
            var $productCardWrapper = $(this); // This is the col-lg-2 div
            var $productCard = $productCardWrapper.find('product-card.box'); // Get the product-card

            if ($productCard.length > 0) {
                const name = $productCard.attr('data-name') || '';
                const sku = $productCard.attr('data-sku') || '';
                if (matcher.test(name + ' ' + sku)) {
                    $productCardWrapper.fadeIn(450);
                } else {
                    $productCardWrapper.fadeOut(450);
                }
            }
        });
    }

    let $search = $("#search").on('input',function(){
        searchProducts();       
    });


    $('body').on('click', '#jq-keyboard button', function(e) {
        if($("#search").is(":focus")) {
            searchProducts(); 
        }          
    });


    function searchOpenOrders() {
        var matcher = new RegExp($("#holdOrderInput").val(), 'gi');
        $('.order').show().not(function(){
            return matcher.test($(this).find('.ref_number').text())
        }).hide();

    }

    var $searchHoldOrder = $("#holdOrderInput").on('input',function () {
        searchOpenOrders();
    });


    $('body').on('click', '.holdOrderKeyboard .key', function() {
        if($("#holdOrderInput").is(":focus")) {
            searchOpenOrders(); 
        }          
    });
 
  
    function searchCustomerOrders() {
        var matcher = new RegExp($("#holdCustomerOrderInput").val(), 'gi');
        $('.customer-order').show().not(function(){
            return matcher.test($(this).find('.customer_name').text())
        }).hide();
    }

    var $searchCustomerOrder = $("#holdCustomerOrderInput").on('input',function () {
        searchCustomerOrders();
    });


    $('body').on('click', '.customerOrderKeyboard .key', function() {
        if($("#holdCustomerOrderInput").is(":focus")) {
            searchCustomerOrders();
        }          
    });
 


    var $list = $('.list-group-item').click(function () {
       $list.removeClass('active');
       $(this).addClass('active');
       if(this.id == 'check'){
            $("#payment").removeAttr("max");
            $("#cardPaymentMethod").show();
            $("#cardInfo").show();
            $("#cardInfo .input-group-addon").text("Check Info");
       }else if(this.id == 'card'){
            $("#payment").attr("max",$("#payablePrice").val())
            $("#cardInfo").show();
            $("#cardPaymentMethod").show();
            $("#cardInfo .input-group-addon").text("Card Info");
       }else if(this.id == 'cash'){
            $("#payment").removeAttr("max");
            $("#cardInfo").hide();
            $("#cardPaymentMethod").hide();
       }
    });

    $("#paymentMethod").change(function(e){
        console.log(this.value)
        if (this.value == "manual") {
            $("#cardInfo").show();
        } else {
            $("#cardInfo").hide();
        }
    })

    $.fn.go = function (value,isDueInput) {
        if(isDueInput){
            $("#refNumber").val($("#refNumber").val()+""+value)
        }else{
            $("#payment").val($("#payment").val()+""+value);
            $(this).calculateChange();
        }
    }


    $.fn.digits = function(){
        $("#payment").val($("#payment").val()+".");
        $(this).calculateChange();
    }

    $.fn.calculateChange = function () {
        var cashActive = $("#cash").hasClass("active");
        var change = $("#payablePrice").val() - $("#payment").val();
        if(change <= 0 && cashActive){
            $("#change").text(change.toFixed(2));
        }else{
            change = 0;
            $("#change").text('0')
        }
        if(change <= 0){
            $("#confirmPayment").show();
        }else{
            $("#confirmPayment").hide();
        }    
    }

})