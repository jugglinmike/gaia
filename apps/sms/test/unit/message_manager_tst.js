'use strict';

requireApp('sms/test/unit/mock_contact.js');
requireApp('sms/js/message_manager.js');

requireApp('sms/test/unit/mock_navigatormoz_sms.js');


suite('MessageManager', function() {

    // TODO: Move this logic into MocksHelper
    suiteSetup(function() {
      this._DesktopMockNavigatormozMobileMessage =
        window.DesktopMockNavigatormozMobileMessage;
      window.DesktopMockNavigatormozMobileMessage =
        window.MockNavigatormozMobileMessage;
    });

    suiteTeardown(function() {
      window.DesktopMockNavigatormozMobileMessage =
        this._DesktopMockNavigatormozMobileMessage;
    });
 
    suite('getMessage', function() {
      setup(function() {
        MessageManager.init();
      });

      test('returns a valid DOMRequest instance', function() {
        assert.instanceOf(MessageManager.getMessage(3), DOMRequest);
      });
    });
});
