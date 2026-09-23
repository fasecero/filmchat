import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
export { buildInviteLink } from '../utils/inviteLink';

export type InviteReference = {
  inviteId: string;
  token: string;
};

export type InvitePreview = {
  available: boolean;
  groupId: string;
  groupName: string;
};

const call = <Request, Response>(name: string) =>
  httpsCallable<Request, Response>(functions, name);

export const createInvite = async (groupId: string) => {
  const response = await call<{ groupId: string }, InviteReference & {
    groupName: string;
  }>('createInvite')({ groupId });
  return response.data;
};

export const previewInvite = async (invite: InviteReference) => {
  const response = await call<InviteReference, InvitePreview>('previewInvite')(invite);
  return response.data;
};

export const redeemInvite = async (invite: InviteReference) => {
  const response = await call<InviteReference, {
    groupId: string;
    groupName: string;
    membershipStatus: 'active' | 'joined';
  }>('redeemInvite')(invite);
  return response.data;
};

export const leaveGroup = async (groupId: string) => {
  const response = await call<{ groupId: string }, { groupId: string; status: 'left' }>('leaveGroup')({ groupId });
  return response.data;
};
