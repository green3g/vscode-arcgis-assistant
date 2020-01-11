import cleanString from './cleanString';

describe('lib/util/cleanString', () => {
    it('removes spaces as expected', () => {
        expect(cleanString('test this  item  ')).toEqual('testthisitem');
    })
})