$(function() {
    $('#admin-content-textarea').redactor({
        minHeight: 100,
        convertImageLinks: true,
        imageUpload: '{{ upload_img_inline }}',
        imageUploadCallback: function(image,json) { /* alert('uploaded'); */ },
        imageUploadErrorCallback: function(json) { alert('error'); },
        modalOpenedCallback: function() {
        // create app engine upload link via ajax
        $.getJSON('/upload-url?bucket={{ client.namespace_url }}', function (result) {
            // data.url = result;
            // alert('test: ' + result);
        });
        },
        uploadFields: {
                        'field1': '#field1',
                        'field2': '12345'
                    },
        buttons: ['formatting', 'bold', 'italic', 'link', 'unorderedlist', 'image', 'video', 'file', 'table', 'alignment', 'html']
    })
});