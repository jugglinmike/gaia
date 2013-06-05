/** Creates an Attachment object
 * @param {String} type of attachment (image, video, etc).
 * @param {String} uri Location or datauri of image to show.
 * @param {Number} size Size of attachment in bytes.
 * @return {Attachment} new attachment object.
 *
 * The render method creates an iframe to represent the
 * attachment in the message composition area. An iframe
 * is used because Gecko will still try to put the
 * cursor into elements with [contentEditable=false].
 * Instead of a bunch of JavaScript to manage where the
 * caret is and what to delete on backspace, the
 * contentEditable region treats the iframe as a simple
 * block. Win.
 *
 * It uses the main sms.css stylesheet so that styles
 * can be defined in that.
 */

'use strict';

function Attachment(blob, name, origin) {
  this.blob = blob;
  this.name = name || '';
  this.origin = origin;
}

Attachment.prototype = {
  get size() {
    return this.blob.size;
  },
  get type() {
    return Utils.typeFromMimeType(this.blob.type);
  },
  handleLoad: function(objectURL, event) {
    // Signal Gecko to release the reference to the Blob
    if (objectURL) {
      URL.revokeObjectURL(objectURL);
    }

    // Bubble click events from inside the iframe
    event.target.contentDocument.addEventListener('click',
      event.target.click.bind(event.target));

    // Bubble the contextmenu(longpress) as a click
    event.target.contentDocument.addEventListener('contextmenu',
      event.target.click.bind(event.target));
  },
  render: function() {
    var el = document.createElement('iframe');
    var baseURL = location.protocol + "//" + location.host;
    var objectURL, inlineStyle;

    // The attachment's iFrame requires access to the parent document's context
    // so that URIs for Blobs created in the parent may resolve as expected.
    el.setAttribute('sandbox', 'allow-same-origin');
    el.className = 'mms-attachment';
    el.dataset.attachmentType = this.type;

    // We special case audio to display an image of an audio attachment video
    // currently falls through this path too, we should revisit this with
    // Bug 869244 - [MMS] 'Thumbnail'/'Poster' in video attachment is needed.
    if (this.type === 'img') {
      objectURL = window.URL.createObjectURL(this.blob);
      inlineStyle = 'background-image: url(' + objectURL + ');';
    }

    // When rendering is complete
    el.addEventListener('load', this.handleLoad.bind(this, objectURL));

    var _ = navigator.mozL10n.get;
    var src = 'data:text/html,';
    // We want kilobytes so we divide by 1024, with one fractional digit
    var size = Math.floor(this.size / 102.4) / 10;
    var sizeString = _('attachmentSize', {n: size});
    src += Utils.Template('attachment-tmpl').interpolate({
      origin: this.origin,
      type: this.type,
      inlineStyle: inlineStyle,
      baseURL: baseURL,
      imgSrc: objectURL,
      size: sizeString
    });
    el.src = src;

    return el;
  },

  view: function() {
    var activity = new MozActivity({
      name: 'open',
      data: {
        type: this.blob.type,
        filename: this.name,
        blob: this.blob
      }
    });
    activity.onerror = function() {
      var _ = navigator.mozL10n.get;
      console.error('error with open activity', this.error.name);
      alert(_('attachmentOpenError'));
    };
  }
};
