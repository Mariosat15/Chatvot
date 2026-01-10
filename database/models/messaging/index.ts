// Messaging Models Index
// Export types and interfaces
export * from './conversation.model';
export * from './message.model';
export * from './friend.model';
export * from './messaging-settings.model';
export * from './user-presence.model';

// Re-export default models with their types
import ConversationModel from './conversation.model';
import MessageModel from './message.model';
import { FriendRequest as FriendRequestModel, Friendship as FriendshipModel } from './friend.model';
import MessagingSettingsModel from './messaging-settings.model';
import UserPresenceModel from './user-presence.model';

// Export with proper types preserved
export const Conversation = ConversationModel;
export const Message = MessageModel;
export const FriendRequest = FriendRequestModel;
export const Friendship = FriendshipModel;
export const MessagingSettings = MessagingSettingsModel;
export const UserPresence = UserPresenceModel;

