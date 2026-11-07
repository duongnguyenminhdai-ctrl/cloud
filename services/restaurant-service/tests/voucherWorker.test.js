jest.mock('../redis', () => ({
  setQuota: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/models/Voucher');
jest.mock('../src/rabbitmq', () => ({
  consumeEvent: jest.fn()
}));

const { setQuota } = require('../redis');
const Voucher = require('../src/models/Voucher');
const { consumeEvent } = require('../src/rabbitmq');
const { startVoucherIncentiveWorker } = require('../src/workers/voucherIncentiveWorker');

describe('Voucher Incentive Worker - Event-Driven RabbitMQ Consumer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Tự động tạo voucher SORRY-XXXXXX giảm 20% khi rating <= 2', async () => {
    let capturedCallback = null;
    consumeEvent.mockImplementation((exchange, queue, key, callback) => {
      capturedCallback = callback;
    });

    await startVoucherIncentiveWorker();

    expect(consumeEvent).toHaveBeenCalledWith(
      'foodfast_events',
      'q.voucher_incentive',
      'review.submitted',
      expect.any(Function)
    );

    // Kích hoạt callback với rating = 1
    const mockSave = jest.fn().mockResolvedValue(true);
    Voucher.mockImplementation((data) => ({
      ...data,
      save: mockSave
    }));

    await capturedCallback({
      user_id: 'user_sad_01',
      store_id: 'store_001',
      rating: 1
    });

    expect(mockSave).toHaveBeenCalled();
    expect(setQuota).toHaveBeenCalledWith(expect.stringMatching(/^voucher:quota:SORRY-/), 1);
  });

  it('Tự động tạo voucher THANKYOU-XXXXXX giảm 10% khi rating === 5', async () => {
    let capturedCallback = null;
    consumeEvent.mockImplementation((exchange, queue, key, callback) => {
      capturedCallback = callback;
    });

    await startVoucherIncentiveWorker();

    const mockSave = jest.fn().mockResolvedValue(true);
    Voucher.mockImplementation((data) => ({
      ...data,
      save: mockSave
    }));

    await capturedCallback({
      user_id: 'user_happy_01',
      store_id: 'store_001',
      rating: 5
    });

    expect(mockSave).toHaveBeenCalled();
    expect(setQuota).toHaveBeenCalledWith(expect.stringMatching(/^voucher:quota:THANKYOU-/), 1);
  });
});

