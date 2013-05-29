/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
(function(global) {
'use strict';

var attachmentMap = new WeakMap();

function thui_mmsAttachmentClick(target) {
  var attachment = attachmentMap.get(target);
  if (!attachment) {
    return false;
  }
  var activity = new MozActivity({
    name: 'open',
    data: {
      allowSave: true,
      blob: attachment.blob,
      filename: attachment.name,
      type: attachment.blob.type
    }
  });
  activity.onerror = function() {
    console.error('error with open activity', this.error.name);
    // TODO: Add an alert here with a string saying something like
    // "There is no application available to open this file type"
  };
  return true;
}

// reduce the Composer.getContent() into slide format used by SMIL.generate some
// day in the future, we should make the SMIL and Compose use the same format
function thui_generateSmilSlides(slides, content) {
  var length = slides.length;
  if (typeof content === 'string') {
    if (!length || slides[length - 1].text) {
      slides.push({
        text: content
      });
    } else {
      slides[length - 1].text = content;
    }
  } else {
    slides.push({
      blob: content.blob,
      name: content.name
    });
  }
  return slides;
}

var ThreadUI = global.ThreadUI = {
  // Time buffer for the 'last-messages' set. In this case 10 min
  LAST_MESSSAGES_BUFFERING_TIME: 10 * 60 * 1000,
  CHUNK_SIZE: 10,
  // duration of the notification that message type was converted
  CONVERTED_MESSAGE_DURATION: 3000,
  recipients: null,
  init: function thui_init() {
    var _ = navigator.mozL10n.get;
    var templateIds = ['contact', 'highlight', 'message', 'not-downloaded',
      'recipient'];

    Compose.init('messages-compose-form');
    AttachmentMenu.init('attachment-options-menu');

    // Fields with 'messages' label
    [
      'container', 'to-field', 'recipients-list',
      'header-text', 'recipient', 'input', 'compose-form',
      'check-all-button', 'uncheck-all-button',
      'contact-pick-button', 'back-button', 'send-button', 'attach-button',
      'delete-button', 'cancel-button',
      'edit-mode', 'edit-form', 'tel-form',
      'max-length-notice', 'convert-notice'
    ].forEach(function(id) {
      this[Utils.camelCase(id)] = document.getElementById('messages-' + id);
    }, this);

    this.mainWrapper = document.getElementById('main-wrapper');

    // Allow for stubbing in environments that do not implement the
    // `navigator.mozMobileMessage` API
    this._mozMobileMessage = navigator.mozMobileMessage ||
      window.DesktopMockNavigatormozMobileMessage;

    // In case of input, we have to resize the input following UX Specs.
    Compose.on('input', this.messageComposerInputHandler.bind(this));

    Compose.on('type', this.messageComposerTypeHandler.bind(this));

    this.toField.addEventListener(
      'keypress', this.toFieldKeypress.bind(this), true
    );

    this.toField.addEventListener(
      'input', this.toFieldInput.bind(this), true
    );

    // Handlers for send button and avoiding to hide keyboard instead
    this.sendButton.addEventListener(
      'mousedown', function mouseDown(event) {
        event.preventDefault();
        event.target.classList.add('active');
      }
    );

    this.sendButton.addEventListener(
      'mouseup', function mouseUp(event) {
        event.target.classList.remove('active');
      }
    );

    this.sendButton.addEventListener(
      'mouseout', function mouseOut(event) {
        event.target.classList.remove('active');
      }
    );

    this.sendButton.addEventListener(
      'click', this.onSendClick.bind(this)
    );

    this.container.addEventListener(
      'scroll', this.manageScroll.bind(this)
    );

    this.backButton.addEventListener(
      'click', this.back.bind(this)
    );

    this.checkAllButton.addEventListener(
      'click', this.toggleCheckedAll.bind(this, true)
    );

    this.uncheckAllButton.addEventListener(
      'click', this.toggleCheckedAll.bind(this, false)
    );

    this.cancelButton.addEventListener(
      'click', this.cancelEdit.bind(this)
    );

    this.deleteButton.addEventListener(
      'click', this.delete.bind(this)
    );

    /**
     * WARN: This is incorrect. Tapping the header should
     * open the participants view:
     *
     * https://bugzilla.mozilla.org/show_bug.cgi?id=870069
     *
     */
    this.headerText.addEventListener(
      'click', this.activateContact.bind(this)
    );

    // When 'focus' we have to remove 'edit-mode' in the recipient
    this.input.addEventListener(
      'focus', this.messageComposerFocusHandler.bind(this)
    );

    this.container.addEventListener(
      'click', this.handleEvent.bind(this)
    );
    this.container.addEventListener(
      'contextmenu', this.handleEvent.bind(this)
    );
    this.editForm.addEventListener(
      'submit', this.handleEvent.bind(this)
    );
    this.composeForm.addEventListener(
      'submit', this.handleEvent.bind(this)
    );
    // For picking a contact from Contacts. It's mouse down for
    // avoiding weird effect of keyboard, as in 'send' button.
    this.contactPickButton.addEventListener(
      'mousedown', this.requestContact.bind(this)
    );

    this.tmpl = templateIds.reduce(function(tmpls, name) {
      tmpls[Utils.camelCase(name)] =
        Utils.Template('messages-' + name + '-tmpl');
      return tmpls;
    }, {});

    Utils.startTimeHeaderScheduler();

    this.initRecipients();

    // Initialized here, but used in ThreadUI.cleanFields
    this.previousHash = null;

    // Cache fixed measurement while init
    var style = window.getComputedStyle(this.input, null);
    this.INPUT_PADDING = parseInt(style.getPropertyValue('padding-top'), 10) +
      parseInt(style.getPropertyValue('padding-bottom'), 10);
    this.INPUT_MARGIN = parseInt(style.getPropertyValue('margin-top'), 10) +
      parseInt(style.getPropertyValue('margin-bottom'), 10);
  },

  // Initialize Recipients list and Recipients.View (DOM)
  initRecipients: function thui_initRecipients() {
    function recipientsChanged(count) {
      var message = count ?
        (count > 1 ? 'recipient[many]' : 'recipient[one]') :
        'newMessage';

      this.headerText.textContent = navigator.mozL10n.get(message, {
        n: count
      });

      // check for enable send whenever recipients change
      this.enableSend();
      // Clean search result after recipient count change.
      this.container.textContent = '';
    }

    if (this.recipients) {
      this.recipients.length = 0;
      this.recipients.focus();
    } else {
      this.recipients = new Recipients({
        outer: 'messages-to-field',
        inner: 'messages-recipients-list',
        template: this.tmpl.recipient
      });

      this.recipients.on('add', recipientsChanged.bind(this));
      this.recipients.on('remove', recipientsChanged.bind(this));
    }
    this.container.textContent = '';
  },

  initSentAudio: function thui_initSentAudio() {
    if (this.sentAudio)
      return;

    this.sentAudioKey = 'message.sent-sound.enabled';
    this.sentAudio = new Audio('/sounds/sent.ogg');
    this.sentAudio.mozAudioChannelType = 'notification';
    this.sentAudioEnabled = false;

    // navigator.mozSettings may not be defined in all environments
    if (navigator.mozSettings) {
      var req = navigator.mozSettings.createLock().get(this.sentAudioKey);
      req.onsuccess = (function onsuccess() {
        this.sentAudioEnabled = req.result[this.sentAudioKey];
      }).bind(this);

      navigator.mozSettings.addObserver(this.sentAudioKey, (function(e) {
        this.sentAudioEnabled = e.settingValue;
      }).bind(this));
    }
  },

  // Method for setting the body of a SMS/MMS from activity
  setMessageBody: function thui_setMessageBody(value) {
    Compose.clear();
    Compose.append(value);
  },

  messageComposerInputHandler: function thui_messageInputHandler(event) {
    this.updateInputHeight();
    this.enableSend();
  },

  messageComposerFocusHandler: function thui_messageInputHandler(event) {
    var node = this.recipientsList.lastChild;
    var typed;

    // Restore the recipients list input area to
    // single line view.
    this.recipients.visible('singleline', {
      refocus: this.input,
      noPreserve: true
    });

    do {
      if (node.isPlaceholder) {
        typed = node.textContent.trim();

        // If the user actually typed something,
        // assume it's a manually entered recipient.
        // Push a recipient into the recipients
        // list with the left behind entry.
        if (typed) {
          this.recipients.add({
            name: typed,
            number: typed,
            source: 'manual'
          });
          break;
        }
      }
    } while (node = node.previousSibling);
  },

  // Message composer type changed:
  messageComposerTypeHandler: function thui_messageComposerTypeHandler(event) {
    // if we are changing to sms type, we might want to cancel
    if (Compose.type === 'sms') {
      if (this.updateSmsSegmentLimit()) {
        return event.preventDefault();
      }
    }

    var message = navigator.mozL10n.get('converted-to-' + Compose.type);
    this.convertNotice.querySelector('p').textContent = message;
    this.convertNotice.classList.remove('hide');

    if (this._convertNoticeTimeout) {
      clearTimeout(this._convertNoticeTimeout);
    }

    this._convertNoticeTimeout = setTimeout(function hideConvertNotice() {
      this.convertNotice.classList.add('hide');
    }.bind(this), this.CONVERTED_MESSAGE_DURATION);
  },

  // Create a recipient from contacts activity.
  requestContact: function thui_requestContact() {
    if (typeof MozActivity === 'undefined') {
      console.log('MozActivity unavailable');
      return;
    }

    var activity = new MozActivity({
      name: 'pick',
      data: {
        type: 'webcontacts/contact'
      }
    });

    activity.onsuccess = (function() {
      var details = Utils.getContactDetails('', activity.result);

      this.recipients.add({
        name: details.title || details.number || activity.result.name[0],
        number: details.number || activity.result.number,
        source: 'contacts'
      });
    }).bind(this);

    activity.onerror = (function(e) {
      console.log('WebActivities unavailable? : ' + e);
    }).bind(this);
  },

  // Method for updating the header when needed
  updateComposerHeader: function thui_updateComposerHeader() {
    var recipientCount = this.recipients.length;
    if (recipientCount > 0) {
      this.contactPickButton.classList.add('disabled');
      this.headerText.textContent =
        navigator.mozL10n.get('recipient', {
          n: recipientCount
      });
    } else {
      this.contactPickButton.classList.remove('disabled');
      this.headerText.textContent = navigator.mozL10n.get('newMessage');
    }
    // Check if we need to enable send button.
    this.enableSend();
  },

  // We define an edge for showing the following chunk of elements
  manageScroll: function thui_manageScroll(oEvent) {
    // kEdge will be the limit (in pixels) for showing the next chunk
    var kEdge = 30;
    var currentScroll = this.container.scrollTop;
    if (currentScroll < kEdge) {
      var previous = this.container.scrollHeight;
      this.showChunkOfMessages(this.CHUNK_SIZE);
      // We update the scroll to the previous position
      // taking into account the previous offset to top
      // and the current height due to we have added a new
      // chunk of visible messages
      this.container.scrollTop =
        (this.container.scrollHeight - previous) + currentScroll;
    }
  },

  setInputMaxHeight: function thui_setInputMaxHeight() {
    // Method for initializing the maximum height
    // Set the input height to:
    // view height - (vertical padding (+ to field height if edit new message))
    var viewHeight = this.container.offsetHeight;
    var adjustment = this.INPUT_PADDING;
    if (window.location.hash === '#new') {
      adjustment += this.toField.offsetHeight;
    }
    this.input.style.maxHeight = (viewHeight - adjustment) + 'px';
  },

  back: function thui_back() {
    var goBack = (function() {
      this.stopRendering();
      if (Compose.isEmpty()) {
        window.location.hash = '#thread-list';
        return;
      }
      if (window.confirm(navigator.mozL10n.get('discard-sms'))) {
        this.cleanFields(true);
        window.location.hash = '#thread-list';
      }
    }).bind(this);

    // We're waiting for the keyboard to disappear before animating back
    if (this.isKeyboardDisplayed()) {

      window.addEventListener('resize', function keyboardHidden() {
        window.removeEventListener('resize', keyboardHidden);
        window.clearTimeout(setTimer);
        goBack();
      });
      var setTimer = window.setTimeout(goBack, 400);
    } else {
      goBack();
    }
  },

  isKeyboardDisplayed: function thui_isKeyboardDisplayed() {
    // minimal keyboard height is 150px
    return (this.container.offsetHeight < ThreadListUI.fullHeight - 150);
  },

  enableSend: function thui_enableSend() {
    this.initSentAudio();

    // should disable if we have no message input
    var disableSendMessage = Compose.isEmpty();

    var messageNotLong = this.updateCounter();

    // should disable if the message is too long
    disableSendMessage = disableSendMessage || !messageNotLong;

    // should disable if we have no recipients in the "new thread" view
    disableSendMessage = disableSendMessage ||
      (window.location.hash == '#new' && !this.recipients.length);

    this.sendButton.disabled = disableSendMessage;
  },

  scrollViewToBottom: function thui_scrollViewToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  },

  // updates the counter for sms segments when in text only mode
  // returns true when the limit is over the segment limit
  updateSmsSegmentLimit: function thui_updateSmsSegmentLimit() {
    if (!(this._mozMobileMessage &&
          this._mozMobileMessage.getSegmentInfoForText)) {
      return false;
    }

    var value = Compose.getText();
    // We set maximum concatenated number of our SMS app to 10 based on:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=813686#c0
    var kMaxConcatenatedMessages = 10;

    // Use backend api for precise sms segmetation information.
    var smsInfo = this._mozMobileMessage.getSegmentInfoForText(value);
    var segments = smsInfo.segments;
    var availableChars = smsInfo.charsAvailableInLastSegment;

    // in MMS mode, the counter value isn't used anyway, so we can update this
    this.sendButton.dataset.counter = availableChars + '/' + segments;

    // if we are going to force MMS, this is true anyway, so adding has-counter
    // again doesn't hurt us.
    if (segments && (segments > 1 || availableChars <= 10)) {
      this.sendButton.classList.add('has-counter');
    } else {
      this.sendButton.classList.remove('has-counter');
    }

    return segments > kMaxConcatenatedMessages;
  },

  // will return true if we can send the message, false if we can't send the
  // message
  updateCounter: function thui_updateCount() {
    var message;

    if (Compose.type === 'mms') {
      return this.updateCounterForMms();
    }

    Compose.lock = false;
    this.maxLengthNotice.classList.add('hide');
    if (this.updateSmsSegmentLimit()) {
      Compose.type = 'mms';
    }
    return true;
  },

  updateCounterForMms: function thui_updateCounterForMms() {
    // always turn on the counter for mms, it just displays "MMS"
    this.sendButton.classList.add('has-counter');

    if (Settings.mmsSizeLimitation) {
      if (Compose.size > Settings.mmsSizeLimitation) {
        Compose.lock = true;
        this.maxLengthNotice.querySelector('p').textContent =
          navigator.mozL10n.get('messages-exceeded-length-text');
        this.maxLengthNotice.classList.remove('hide');
        return false;
      } else if (Compose.size === Settings.mmsSizeLimitation) {
        Compose.lock = true;
        this.maxLengthNotice.querySelector('p').textContent =
          navigator.mozL10n.get('messages-max-length-text');
        this.maxLengthNotice.classList.remove('hide');
        return true;
      }
    }

    Compose.lock = false;
    this.maxLengthNotice.classList.add('hide');
    return true;
  },

  updateInputHeight: function thui_updateInputHeight() {
    // First of all we retrieve all CSS info which we need
    var inputCss = window.getComputedStyle(this.input, null);
    var inputMaxHeight = parseInt(inputCss.getPropertyValue('max-height'), 10);
    var verticalMargin = this.INPUT_MARGIN;
    var buttonHeight = this.sendButton.offsetHeight;

    // Retrieve elements useful in growing method
    var bottomBar = this.composeForm;

    // We need to grow the input step by step
    this.input.style.height = null;

    // Updating the height if scroll is bigger that height
    // This is when we have reached the header (UX requirement)
    if (this.input.scrollHeight > inputMaxHeight) {
      // TODO: Remove this--the CSS `max-height` attribute will limit the
      // height of the input element in this case
      // Height of the input is the maximum
      this.input.style.height = inputMaxHeight + 'px';
      // Update the bottom bar height taking into account the padding
      bottomBar.style.height = (inputMaxHeight + verticalMargin) + 'px';
      this.container.style.bottom = (inputMaxHeight + verticalMargin - verticalMargin) + 'px';

      // We update the position of the button taking into account the
      // new height
      this.sendButton.style.marginTop = this.attachButton.style.marginTop =
        (this.input.offsetHeight + verticalMargin - buttonHeight) + 'px';
      return;
    }

    // If the scroll height is smaller than original offset height, we keep
    // offset height to keep original height, otherwise we use scroll height
    // with additional margin for preventing scroll bar.
    this.input.style.height =
      this.input.offsetHeight > this.input.scrollHeight ?
      this.input.offsetHeight + 'px' :
      this.input.scrollHeight + 'px';

    // We retrieve current height of the input
    var newHeight = this.input.getBoundingClientRect().height + verticalMargin;

    // We calculate the height of the bottonBar which contains the input
    var bottomBarHeight = newHeight + 'px';
    bottomBar.style.height = bottomBarHeight;

    // We move the buttons to  right position
    var buttonOffset = (this.input.offsetHeight + verticalMargin - buttonHeight) + 'px';
    this.sendButton.style.marginTop = this.attachButton.style.marginTop =
      buttonOffset;

    // Last adjustment to view taking into account the new height of the bar
    this.container.style.bottom = bottomBarHeight;
    this.scrollViewToBottom();
  },

  // Adds a new grouping header if necessary (today, tomorrow, ...)
  getMessageContainer:
    function thui_getMessageContainer(messageTimestamp, hidden) {
    var normalizedTimestamp = Utils.getDayDate(messageTimestamp);
    var referenceTime = Date.now();
    var messageContainer;
    // If timestamp belongs to [referenceTime, referenceTime - TimeBuffer]
    var isLastMessagesBlock =
    (messageTimestamp >= (referenceTime - this.LAST_MESSSAGES_BUFFERING_TIME));
    // Is there any container with our requirements?
    if (isLastMessagesBlock) {
      messageContainer = document.getElementById('last-messages');
    } else {
      messageContainer = document.getElementById('mc_' + normalizedTimestamp);
    }

    if (messageContainer) {
      return messageContainer;
    }
    // If there is no messageContainer we have to create it
    // Create DOM Element for header
    var header = document.createElement('header');
    // Append 'time-update' state
    header.dataset.timeUpdate = true;
    header.dataset.time = messageTimestamp;
    if (hidden) {
      header.classList.add('hidden');
    }
    // Add text
    var content;
    if (!isLastMessagesBlock) {
      content = Utils.getHeaderDate(messageTimestamp) + ' ' +
                Utils.getFormattedHour(messageTimestamp);
    } else {
      content = Utils.getFormattedHour(messageTimestamp);
      header.dataset.hourOnly = 'true';
    }
    header.innerHTML = content;
    // Create list element for ul
    messageContainer = document.createElement('ul');
    if (!isLastMessagesBlock) {
      messageContainer.id = 'mc_' + normalizedTimestamp;
    } else {
      messageContainer.id = 'last-messages';
    }
    messageContainer.dataset.timestamp = normalizedTimestamp;
    // Where do I have to append the Container?
    // If is the first block or is the 'last-messages' one should be the
    // most recent one.
    if (isLastMessagesBlock || !ThreadUI.container.firstElementChild) {
      ThreadUI.container.appendChild(header);
      ThreadUI.container.appendChild(messageContainer);
      return messageContainer;
    }
    // In other case we have to look for the right place for appending
    // the message
    var messageContainers = ThreadUI.container.getElementsByTagName('ul');
    var insertBeforeContainer;
    for (var i = 0, l = messageContainers.length; i < l; i++) {
      if (normalizedTimestamp < messageContainers[i].dataset.timestamp) {
        insertBeforeContainer = messageContainers[i];
        break;
      }
    }
    // If is undefined we try witn the 'last-messages' block
    if (!insertBeforeContainer) {
      insertBeforeContainer = document.getElementById('last-messages');
    }
    // Finally we append the container & header in the right position
    if (insertBeforeContainer) {
      ThreadUI.container.insertBefore(messageContainer,
        insertBeforeContainer.previousSibling);
      ThreadUI.container.insertBefore(header, messageContainer);
    } else {
      ThreadUI.container.appendChild(header);
      ThreadUI.container.appendChild(messageContainer);
    }
    return messageContainer;
  },

  // Method for updating the header with the info retrieved from Contacts API
  updateHeaderData: function thui_updateHeaderData(callback) {
    var thread, number, others;

    if (Threads.currentId) {
      thread = Threads.active;
    }

    if (!thread) {
      if (callback) {
        callback();
      }
      return;
    }

    number = thread.participants[0];
    others = thread.participants.length - 1;

    // For Desktop testing, there is a fake mozContacts but it's not working
    // completely. So in the case of Desktop testing we are going to execute
    // the callback directly in order to make it work!
    // https://bugzilla.mozilla.org/show_bug.cgi?id=836733
    if (!navigator.mozMobileMessage && callback) {
      this.headerText.textContent = navigator.mozL10n.get(
        'thread-header-text', {
        name: number,
        n: others
      });
      setTimeout(callback);
      return;
    }

    // Add data to contact activity interaction
    this.headerText.dataset.phoneNumber = number;

    // For the basic display, we only need the first contact's information --
    // e.g. for 3 contacts, the app displays:
    //
    //    Jane Doe (+2)
    //
    Contacts.findByPhoneNumber(number, function gotContact(contacts) {
      var carrierTag = document.getElementById('contact-carrier');
      /** If we have more than one contact sharing the same phone number
       *  we show the title of contact detail with validate name/company
       *  and how many other contacts share that same number. We think it's
       *  user's responsability to correct this mess with the agenda.
       */
      // Bug 867948: contacts null is a legitimate case, and
      // getContactDetails is okay with that.
      var details = Utils.getContactDetails(number, contacts);
      var contactName = details.title || number;

      this.headerText.dataset.isContact = !!details.isContact;
      this.headerText.textContent = navigator.mozL10n.get(
        'thread-header-text', {
          name: contactName,
          n: others
      });

      if (details.carrier) {
        carrierTag.textContent = details.carrier;
        carrierTag.classList.remove('hide');
      } else {
        carrierTag.classList.add('hide');
      }

      if (callback) {
        callback();
      }
    }.bind(this));
  },

  initializeRendering: function thui_initializeRendering(messages, callback) {
    // Clean fields
    this.cleanFields();
    this.checkInputs();
    // Clean list of messages
    this.container.innerHTML = '';
    // Init readMessages array
    this.readMessages = [];
    // Initialize infinite scroll params
    this.messageIndex = 0;
    // reset stopRendering boolean
    this._stopRenderingNextStep = false;
  },

  // Method for stopping the rendering when clicking back
  stopRendering: function thui_stopRendering() {
    this._stopRenderingNextStep = true;
  },

  // Method for rendering the first chunk at the beginning
  showFirstChunk: function thui_showFirstChunk() {
    // Show chunk of messages
    ThreadUI.showChunkOfMessages(this.CHUNK_SIZE);
    // Boot update of headers
    Utils.updateTimeHeaders();
    // Go to Bottom
    ThreadUI.scrollViewToBottom();
  },

  createMmsContent: function thui_createMmsContent(dataArray) {
    var container = document.createDocumentFragment();
    dataArray.forEach(function(attachment) {
      var mediaElement, textElement;

      if (attachment.name && attachment.blob) {
        var type = Utils.typeFromMimeType(attachment.blob.type);
        if (type) {
          // we special case audio to display an image of an audio attachment
          // video currently falls through this path too, we should revisit this
          // with #869244
          if (type === 'audio' || type === 'video') {
            mediaElement = document.createElement('div');
            mediaElement.className = type + '-placeholder';
          } else {
            mediaElement = document.createElement(type);
            mediaElement.src = URL.createObjectURL(attachment.blob);
            mediaElement.onload = function() {
              URL.revokeObjectURL(this.src);
            };
          }
          mediaElement.classList.add('mms-media');
          container.appendChild(mediaElement);
          attachmentMap.set(mediaElement, attachment);
        }
      }

      if (attachment.text) {
        textElement = document.createElement('span');

        // escape text for html and look for clickable numbers, etc.
        var text = Utils.escapeHTML(attachment.text);
        text = LinkHelper.searchAndLinkClickableData(text);

        textElement.innerHTML = text;
        container.appendChild(textElement);
      }
    });
    return container;
  },

  // Method for rendering the list of messages using infinite scroll
  renderMessages: function thui_renderMessages(filter, callback) {
    // We initialize all params before rendering
    this.initializeRendering();
    // We call getMessages with callbacks
    var self = this;
    var onMessagesRendered = function messagesRendered() {
      if (self.messageIndex < self.CHUNK_SIZE) {
        self.showFirstChunk();
      }
      // Update STATUS of messages if needed
      filter.read = false;
      if (callback) {
        callback();
      }
      setTimeout(function updatingStatus() {
        var messagesUnreadIDs = [];
        var changeStatusOptions = {
          each: function addUnreadMessage(message) {
            messagesUnreadIDs.push(message.id);
            return true;
          },
          filter: filter,
          invert: true,
          end: function handleUnread() {
            MessageManager.markMessagesRead(messagesUnreadIDs, true);
          }
        };
        MessageManager.getMessages(changeStatusOptions);
      });
    };
    var renderingOptions = {
      each: function renderMessage(message) {
        if (self._stopRenderingNextStep) {
          // stop the iteration
          return false;
        }
        self.appendMessage(message,/*hidden*/ true);
        self.messageIndex++;
        if (self.messageIndex === self.CHUNK_SIZE) {
          self.showFirstChunk();
        }
        return true;
      },
      filter: filter,
      invert: false,
      end: onMessagesRendered
    };
    MessageManager.getMessages(renderingOptions);
  },

  // generates the html for not-downloaded messages - pushes class names into
  // the classNames array also passed in, returns an HTML string
  _createNotDownloadedHTML:
  function thui_createNotDownloadedHTML(message, classNames) {

    var _ = navigator.mozL10n.get;

    // default strings:
    var messageString = 'not-downloaded-mms';
    var downloadString = 'download';

    // assuming that incoming message only has one deliveryStatus
    var status = message.deliveryStatus[0];

    var expireFormatted = Utils.date.format.localeFormat(
      message.expiryDate, _('dateTimeFormat_%x')
    );

    var expired = +message.expiryDate < Date.now();

    if (expired) {
      classNames.push('expired');
      messageString = 'expired-mms';
    }

    if (status === 'error') {
      classNames.push('error');
    }

    if (status === 'pending') {
      downloadString = 'downloading';
      classNames.push('pending');
    }

    messageString = _(messageString, { date: expireFormatted });
    return this.tmpl.notDownloaded.interpolate({
      message: messageString,
      download: _(downloadString)
    });
  },

  buildMessageDOM: function thui_buildMessageDOM(message, hidden) {
    var bodyHTML = '';
    var delivery = message.delivery;
    var messageDOM = document.createElement('li');

    var classNames = ['message', message.type, delivery];

    var notDownloaded = delivery === 'not-downloaded';

    if (delivery === 'received' || notDownloaded) {
      classNames.push('incoming');
    } else {
      classNames.push('outgoing');
    }

    if (hidden) {
      classNames.push('hidden');
    }

    if (message.type && message.type === 'sms') {
      bodyHTML = LinkHelper.searchAndLinkClickableData(
        Utils.Message.format(message.body || '')
      );
    }

    if (notDownloaded) {
      bodyHTML = this._createNotDownloadedHTML(message, classNames);
    }

    messageDOM.className = classNames.join(' ');
    messageDOM.id = 'message-' + message.id;
    messageDOM.dataset.messageId = message.id;

    messageDOM.innerHTML = this.tmpl.message.interpolate({
      id: String(message.id),
      bodyHTML: bodyHTML
    }, {
      safe: ['bodyHTML']
    });

    if (message.type === 'mms' && !notDownloaded) { // MMS
      var pElement = messageDOM.querySelector('p');
      SMIL.parse(message, function(slideArray) {
        pElement.appendChild(ThreadUI.createMmsContent(slideArray));
      });
    }

    return messageDOM;
  },

  appendMessage: function thui_appendMessage(message, hidden) {
    var timestamp = message.timestamp.getTime();

    // look for an old message and remove it first - prevent anything from ever
    // double rendering for now
    var messageDOM = this.container.querySelector(
      '[data-message-id="' + message.id + '"]');
    if (messageDOM) {
      this.removeMessageDOM(messageDOM);
    }

    // build messageDOM adding the links
    messageDOM = this.buildMessageDOM(message, hidden);

    messageDOM.dataset.timestamp = timestamp;
    // Add to the right position
    var messageContainer = ThreadUI.getMessageContainer(timestamp, hidden);
    if (!messageContainer.firstElementChild) {
      messageContainer.appendChild(messageDOM);
    } else {
      var messages = messageContainer.children;
      var appended = false;
      for (var i = 0, l = messages.length; i < l; i++) {
        if (timestamp < messages[i].dataset.timestamp) {
          messageContainer.insertBefore(messageDOM, messages[i]);
          appended = true;
          break;
        }
      }
      if (!appended) {
        messageContainer.appendChild(messageDOM);
      }
    }

    if (this.mainWrapper.classList.contains('edit')) {
      this.checkInputs();
    }
  },

  showChunkOfMessages: function thui_showChunkOfMessages(number) {
    var elements = ThreadUI.container.getElementsByClassName('hidden');
    for (var i = elements.length - 1; i >= 0; i--) {
      elements[i].classList.remove('hidden');
    }
  },

  cleanForm: function thui_cleanForm() {
    // Reset all inputs
    var inputs = this.container.querySelectorAll('input[type="checkbox"]');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].checked = false;
      inputs[i].parentNode.parentNode.classList.remove('undo-candidate');
    }
    // Reset vars for deleting methods
    this.checkInputs();
  },

  clear: function thui_clear() {
    this.initRecipients();
  },

  toggleCheckedAll: function thui_select(value) {
    var inputs = this.container.querySelectorAll(
      'input[type="checkbox"]' +
      // value ?
      //   true : query for currently unselected threads
      //   false: query for currently selected threads
      (value ? ':not(:checked)' : ':checked')
    );
    var length = inputs.length;
    for (var i = 0; i < length; i++) {
      inputs[i].checked = value;
      this.chooseMessage(inputs[i]);
    }
    this.checkInputs();
  },

  delete: function thui_delete() {
    var question = navigator.mozL10n.get('deleteMessages-confirmation');
    if (window.confirm(question)) {
      WaitingScreen.show();
      var delNumList = [];
      var inputs = ThreadUI.container.querySelectorAll(
        'input[type="checkbox"]:checked'
      );
      var length = inputs.length;
      for (var i = 0; i < length; i++) {
        delNumList.push(+inputs[i].value);
      }

      // Method for deleting all inputs selected
      var deleteMessages = function() {
        MessageManager.getThreads(ThreadListUI.renderThreads,
        function afterRender() {
          var completeDeletionDone = false;
          // Then sending/received messages
          for (var i = 0; i < length; i++) {
            ThreadUI.removeMessageDOM(inputs[i].parentNode.parentNode);
          }

          if (!ThreadUI.container.firstElementChild) {
            ThreadUI.mainWrapper.classList.remove('edit');
            window.location.hash = '#thread-list';
          } else {
            window.history.back();
          }
          WaitingScreen.hide();
        });
      };

      MessageManager.deleteMessages(delNumList, deleteMessages);
    }
  },

  cancelEdit: function thlui_cancelEdit() {
    window.history.go(-1);
  },

  chooseMessage: function thui_chooseMessage(target) {
    if (!target.checked) {
      // Removing red bubble
      target.parentNode.parentNode.classList.remove('selected');
    } else {
      // Adding red bubble
      target.parentNode.parentNode.classList.add('selected');
    }
  },

  checkInputs: function thui_checkInputs() {
    var _ = navigator.mozL10n.get;
    var selected = this.container.querySelectorAll(
      'input[type="checkbox"]:checked'
    );
    var allInputs = this.container.querySelectorAll(
      'input[type="checkbox"]'
    );
    if (selected.length == allInputs.length) {
      this.checkAllButton.disabled = true;
    } else {
      this.checkAllButton.disabled = false;
    }
    if (selected.length > 0) {
      this.uncheckAllButton.disabled = false;
      this.deleteButton.disabled = false;
      this.editMode.innerHTML = _('selected', {n: selected.length});
    } else {
      this.uncheckAllButton.disabled = true;
      this.deleteButton.disabled = true;
      this.editMode.innerHTML = _('editMode');
    }
  },

  handleMessageClick: function thui_handleMessageClick(evt) {
    var currentNode = evt.target;
    var inBubble = false;
    var elems = {};
    var _ = navigator.mozL10n.get;

    // Walk up the DOM, inspecting all the elements
    while (currentNode && currentNode.classList) {
      if (currentNode.classList.contains('bubble')) {
        elems.bubble = currentNode;
      } else if (currentNode.classList.contains('message')) {
        elems.message = currentNode;
      }
      currentNode = currentNode.parentNode;
    }

    // Click event handlers that occur outside of a message element should be
    // defined elsewhere.
    if (!(elems.message && elems.bubble)) {
      return;
    }

    // handle not-downloaded messages
    if (elems.message.classList.contains('not-downloaded')) {

      // do nothing for pending downloads, or expired downloads
      if (elems.message.classList.contains('expired') ||
        elems.message.classList.contains('pending')) {
        return;
      }
      this.retrieveMMS(elems.message.dataset.messageId);
      return;
    }

    // Click events originating from within a "bubble" of an error message
    // should trigger a prompt for retransmission.
    if (elems.message.classList.contains('error')) {
      if (window.confirm(_('resend-confirmation'))) {
        this.resendMessage(elems.message.dataset.messageId);
      }
      return;
    }

  },

  handleEvent: function thui_handleEvent(evt) {
    switch (evt.type) {
      case 'click':
        if (window.location.hash !== '#edit') {
          // if the click wasn't on an attachment check for other clicks
          if (!thui_mmsAttachmentClick(evt.target)) {
            this.handleMessageClick(evt);
            LinkActionHandler.handleTapEvent(evt);
          }
          return;
        }

        var input = evt.target.parentNode.querySelector('input');
        if (input) {
          this.chooseMessage(input);
          this.checkInputs();
        }
        break;
      case 'contextmenu':
        LinkActionHandler.handleLongPressEvent(evt);
        break;
      case 'submit':
        evt.preventDefault();
        break;
    }
  },

  cleanFields: function thui_cleanFields(forceClean) {
    var clean = (function clean() {
      Compose.clear();

      // Compose.clear might cause a conversion from mms -> sms, we need
      // to ensure the message is hidden after we clear fields.
      this.convertNotice.classList.add('hide');

      // reset the counter
      this.sendButton.dataset.counter = '';
      this.sendButton.classList.remove('has-counter');

      if (window.location.hash === '#new') {
        this.initRecipients();
        this.updateComposerHeader();
      }
    }).bind(this);

    if (this.previousHash === window.location.hash ||
        this.previousHash === '#new') {
      if (forceClean) {
        clean();
      }
    } else {
      clean();
    }
    this.enableSend();
    this.previousHash = window.location.hash;
  },

  onSendClick: function thui_onSendClick() {
    // don't send an empty message
    if (Compose.isEmpty()) {
      return;
    }

    // not sure why this happens - replace me if you know
    this.container.classList.remove('hide');

    var content = Compose.getContent();
    var messageType = Compose.type;
    var recipients;

    // Depending where we are, we get different nums
    if (window.location.hash === '#new') {
      if (!this.recipients.length) {
        return;
      }
      recipients = this.recipients.numbers;
    } else {
      recipients = Threads.active.participants;
    }

    // Clean composer fields (this lock any repeated click in 'send' button)
    this.cleanFields(true);

    this.updateHeaderData();

    // Hold onto the recipients until
    MessageManager.activity.recipients = recipients;

    // Send the Message
    if (messageType === 'sms') {
      MessageManager.sendSMS(recipients, content[0]);

      if (recipients.length > 1) {
        window.location.hash = '#thread-list';
      }
    } else {
      var smilSlides = content.reduce(thui_generateSmilSlides, []);
      MessageManager.sendMMS(recipients, smilSlides);
    }
  },

  onMessageSent: function thui_onMessageSent(message) {
    var messageDOM = document.getElementById('message-' + message.id);

    if (!messageDOM) {
      return;
    }

    // Update class names to reflect message state
    messageDOM.classList.remove('sending');
    messageDOM.classList.add('sent');

    // Play the audio notification
    if (this.sentAudioEnabled) {
      this.sentAudio.play();
    }
  },

  onMessageFailed: function thui_onMessageFailed(message) {
    var messageDOM = document.getElementById('message-' + message.id);
    if (!messageDOM) {
      return;
    }
    // Check if it was painted as 'error' before
    if (messageDOM.classList.contains('error')) {
      return;
    }

    // Update class names to reflect message state
    messageDOM.classList.remove('sending');
    messageDOM.classList.add('error');

    this.ifRilDisabled(this.showAirplaneModeError);
  },

  ifRilDisabled: function thui_ifRilDisabled(func) {
    var settings = window.navigator.mozSettings;

    if (settings) {
      // Check if RIL is enabled or not
      var req = settings.createLock().get('ril.radio.disabled');
      req.addEventListener('success', function onsuccess() {
        var rilDisabled = req.result['ril.radio.disabled'];
        rilDisabled && func();
      });
    }
  },

  showAirplaneModeError: function thui_showAirplaneModeError() {
    var _ = navigator.mozL10n.get;
    CustomDialog.show(
      _('sendAirplaneModeTitle'),
      _('sendAirplaneModeBody'),
      {
        title: _('sendAirplaneModeBtnOk'),
        callback: function() {
          CustomDialog.hide();
        }
      }
    );
  },

  removeMessageDOM: function thui_removeMessageDOM(messageDOM) {
    // store the parent so we can check emptiness later
    var messagesContainer = messageDOM.parentNode;

    messagesContainer.removeChild(messageDOM);

    // was this the last one in the ul?
    if (!messagesContainer.firstElementChild) {
      // we remove header & container
      var header = messagesContainer.previousSibling;
      this.container.removeChild(header);
      this.container.removeChild(messagesContainer);
    }
  },

  retrieveMMS: function thui_retrieveMMS(messageId) {
    // force a number
    var id = +messageId;
    var _ = navigator.mozL10n.get;
    var request = MessageManager.retrieveMMS(id);
    var messageDOM = this.container.querySelector(
      '[data-message-id="' + id + '"]');

    messageDOM.classList.add('pending');
    messageDOM.classList.remove('error');
    messageDOM.querySelector('button').textContent = _('downloading');

    request.onsuccess = (function retrieveMMSSuccess() {
      this.removeMessageDOM(messageDOM);
    }).bind(this);

    request.onerror = (function retrieveMMSError() {
      messageDOM.classList.remove('pending');
      messageDOM.classList.add('error');
      messageDOM.querySelector('button').textContent = _('download');
    });
  },

  resendMessage: function thui_resendMessage(id) {
    // force id to be a number
    id = +id;

    var request = MessageManager.getMessage(id);

    request.onsuccess = (function() {
      var message = request.result;
      // delete from Gecko db as well
      MessageManager.deleteMessage(id, function(success) {
        if (!success) {
          return;
        }
        var messageDOM = this.container.querySelector(
          '[data-message-id="' + id + '"]');

        this.removeMessageDOM(messageDOM);
        MessageManager.resendMessage(message);
      }.bind(this));
    }).bind(this);
  },

  // Returns true when a contact has been rendered
  // Returns false when no contact has been rendered
  renderContact: function thui_renderContact(contact, value, contactsUl) {
    // Contact records that don't have phone numbers
    // cannot be sent SMS or MMS messages
    // TODO: Add email checking support for MMS
    if (contact.tel === null) {
      return false;
    }

    var input = value.trim();

    var escaped = Utils.escapeRegex(input);
    var escsubs = escaped.split(/\s+/);
    var tels = contact.tel;
    var regexps = {
      name: new RegExp('(\\b' + escsubs.join(')|(\\b') + ')', 'gi'),
      number: new RegExp(escaped, 'ig')
    };
    var telsLength = tels.length;

    if (!telsLength) {
      return false;
    }
    var details = Utils.getContactDetails(tels[0].value, contact);
    for (var i = 0; i < telsLength; i++) {
      var current = tels[i];
      var number = current.value;
      var title = details.title || number;
      var type = current.type ? (current.type + ' |') : '';

      var contactLi = document.createElement('li');
      var data = {
        name: Utils.escapeHTML(title),
        number: Utils.escapeHTML(number),
        type: type,
        carrier: current.carrier || '',
        nameHTML: '',
        numberHTML: ''
      };

      ['name', 'number'].forEach(function(key) {
        data[key + 'HTML'] = data[key].replace(
          regexps[key], function(match) {
            return this.tmpl.highlight.interpolate({
              str: match
            });
          }.bind(this)
        );
      }, this);

      // Interpolate HTML template with data and inject.
      // Known "safe" HTML values will not be re-sanitized.
      contactLi.innerHTML = this.tmpl.contact.interpolate(data, {
        safe: ['nameHTML', 'numberHTML']
      });
      contactsUl.appendChild(contactLi);
    }
    return true;
  },

  toFieldKeypress: function(event) {
    if (event.keyCode === 13 || event.keyCode === event.DOM_VK_ENTER) {
      this.container.textContent = '';
    }
  },

  toFieldInput: function(event) {
    var typed;
    if (event.target.isPlaceholder) {
      typed = event.target.textContent.trim();
      this.searchContact(typed);
    }
  },

  searchContact: function thui_searchContact(filterValue) {
    if (!filterValue) {
      // In cases where searchContact was invoked for "input"
      // that was actually a "delete" that removed the last
      // character in the recipient input field,
      // eg. type "a", then delete it.
      // Always remove the the existing results.
      this.container.textContent = '';
      return;
    }

    Contacts.findByString(filterValue, function gotContact(contacts) {
      // If the user has cleared the typed input before the
      // results came back, prevent the results from being rendered
      // by returning immediately.
      if (!this.recipients.inputValue) {
        return;
      }
      // There are contacts that match the input.
      this.container.textContent = '';
      if (!contacts || !contacts.length) {
        return;
      }
      // TODO Modify in Bug 861227 in order to create a standalone element
      var contactsUl = document.createElement('ul');
      contactsUl.classList.add('contactList');
      contactsUl.addEventListener('click', function contactsUlHandler(event) {
        // Since the "dataset" DOMStringMap property is essentially
        // just an object of properties that exactly match the properties
        // used for recipients, push the whole dataset object into
        // the current recipients list as a new entry.
        this.recipients.add(
          event.target.dataset
        ).focus();

        // Clean up the event listener
        contactsUl.removeEventListener('click', contactsUlHandler);

        event.stopPropagation();
        event.preventDefault();
      }.bind(this));

      this.container.appendChild(contactsUl);

      // Render each contact in the contacts results
      contacts.forEach(function(contact) {
        this.renderContact(contact, filterValue, contactsUl);
      }, this);
    }.bind(this));
  },

  activateContact: function thui_activateContact() {
    var _ = navigator.mozL10n.get;
    var participants = Threads.active && Threads.active.participants;
    var phoneNumber = this.headerText.dataset.phoneNumber;

    // Do nothing when there are more then one participants
    // in this thread.
    // >1 requires the group participants view.
    // See: https://bugzilla.mozilla.org/show_bug.cgi?id=870069
    if (participants && participants.length > 1) {
      return;
    }

    // Call to 'option menu' or 'dialer' depending on existence of contact
    if (this.headerText.dataset.isContact == 'true') {
      ActivityPicker.call(phoneNumber);
    } else {
      var options = new OptionMenu({
        'items': [
        {
          name: _('call'),
          method: function optionMethod(param) {
            ActivityPicker.call(param);
          },
          params: [phoneNumber]
        },
        {
          name: _('createNewContact'),
          method: function optionMethod(param) {
            ActivityPicker.createNewContact(
              param, ThreadUI.onCreateContact);
          },
          params: [{'tel': phoneNumber}]
        },
        {
          name: _('addToExistingContact'),
          method: function optionMethod(param) {
            ActivityPicker.addToExistingContact(
              param, ThreadUI.onCreateContact);
        },
          params: [{'tel': phoneNumber}]
        },
        {
          name: _('cancel'),
          method: function optionMethod(param) {
          // TODO Add functionality if needed
          }
        }
        ],
        'title': phoneNumber
      });
      options.show();
    }
  },

  onCreateContact: function thui_onCreateContact() {
    ThreadListUI.updateContactsInfo();
    // Update Header if needed
    if (window.location.hash.substr(0, 8) === '#thread=') {
      ThreadUI.updateHeaderData();
    }
  }
};

window.confirm = window.confirm; // allow override in unit tests

window.addEventListener('resize', function resize() {
  ThreadUI.setInputMaxHeight();
  // Scroll to bottom
  ThreadUI.scrollViewToBottom();
});

}(this));
