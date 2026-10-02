import { describe, expect, it } from 'vitest';
import { inviteFromHref } from './invite';

const TOKEN = 'abcdefghijklmnopqrstuvwx';

describe('inviteFromHref', () => {
  it('parses a valid invite URL to origin and token', () => {
    expect(inviteFromHref(`https://club.example.com/join#invite=${TOKEN}`)).toEqual({
      endpoint: 'https://club.example.com',
      token: TOKEN,
    });
  });
  it('accepts a trailing slash and surrounding whitespace', () => {
    expect(inviteFromHref(` https://club.example.com/join/#invite=${TOKEN}\n`)?.token).toBe(TOKEN);
  });
  it('accepts http to the loopback', () => {
    expect(inviteFromHref(`http://localhost:8787/join#invite=${TOKEN}`)?.endpoint).toBe(
      'http://localhost:8787',
    );
  });
  it('rejects the token in the query instead of the fragment', () => {
    expect(inviteFromHref(`https://club.example.com/join?invite=${TOKEN}`)).toBeNull();
  });
  it('rejects http to a non-loopback host', () => {
    expect(inviteFromHref(`http://club.example.com/join#invite=${TOKEN}`)).toBeNull();
    expect(inviteFromHref(`http://192.168.1.5/join#invite=${TOKEN}`)).toBeNull();
  });
  it('rejects other pages, short tokens and junk', () => {
    expect(inviteFromHref(`https://club.example.com/?game=sudoku#invite=${TOKEN}`)).toBeNull();
    expect(inviteFromHref(`https://club.example.com/join#invite=short`)).toBeNull();
    expect(inviteFromHref('not a url')).toBeNull();
    expect(inviteFromHref('https://club.example.com/join')).toBeNull();
  });
});
