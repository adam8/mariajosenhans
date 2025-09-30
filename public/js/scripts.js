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

document.addEventListener('DOMContentLoaded', function() {
    const nav = document.getElementsByClassName("page-nav")[0];
    const hamburger = document.getElementsByClassName("page-nav-hamburger")[0];
    const blocker = document.getElementsByClassName("page-nav-blocker")[0];

    hamburger.addEventListener('click', function(event) {
        event.preventDefault();

        nav.classList.toggle('active');
        hamburger.classList.toggle('active');
        blocker.classList.toggle('active');
    })

    blocker.addEventListener('click', function(event) {
        event.preventDefault();

        nav.classList.remove('active');
        hamburger.classList.remove('active');
        blocker.classList.remove('active');
    })
});