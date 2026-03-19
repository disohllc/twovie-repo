import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Profile, FriendInvitation } from '@/types/database';
import { Users, UserPlus, X, Check, Trash2, Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import NotificationsModal from '@/components/NotificationsModal';
import { useFocusEffect } from '@react-navigation/native';

type FriendWithProfile = {
  id: string;
  friend: Profile;
};

type InvitationWithProfile = FriendInvitation & {
  inviter: Profile;
};

export default function Friends() {
  const { profile } = useAuth();
  const router = useRouter();
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [invitations, setInvitations] = useState<InvitationWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      if (profile) {
        loadFriends();
        loadInvitations();
        loadUnreadCount();
      }
    }, [profile])
  );

  const loadUnreadCount = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', profile.id)
        .eq('read', false);

      if (!error && data) {
        setUnreadCount(data.length);
      }
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const loadFriends = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('friendships')
        .select('id, friend_id, user_id')
        .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`)
        .eq('status', 'accepted');

      if (error) throw error;

      const friendIds = (data || []).map((f) =>
        f.user_id === profile.id ? f.friend_id : f.user_id
      );

      if (friendIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', friendIds);

        if (profilesError) throw profilesError;

        const friendsList = (data || []).map((f) => ({
          id: f.id,
          friend: profilesData?.find(
            (p) => p.id === (f.user_id === profile.id ? f.friend_id : f.user_id)
          )!,
        }));

        setFriends(friendsList.filter((f) => f.friend));
      } else {
        setFriends([]);
      }
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const loadInvitations = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('friend_invitations')
        .select('*')
        .eq('invitee_id', profile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const inviterIds = data.map((inv) => inv.inviter_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, display_name, avatar_url')
          .in('id', inviterIds);

        if (profilesError) throw profilesError;

        const invitationsWithProfiles = data.map((inv) => ({
          ...inv,
          inviter: profiles?.find((p) => p.id === inv.inviter_id),
        }));

        setInvitations(invitationsWithProfiles as any);
      } else {
        setInvitations([]);
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteFriend = async () => {
    console.log('=== Starting friend invitation ===');
    console.log('Current user:', profile?.email, profile?.id);
    console.log('Inviting email:', inviteEmail);

    if (!inviteEmail.trim() || !profile) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (inviteEmail.toLowerCase() === profile.email.toLowerCase()) {
      Alert.alert('Error', 'You cannot invite yourself');
      return;
    }

    setInviting(true);
    try {
      console.log('Looking up profile for:', inviteEmail);
      const { data: existingUser, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .ilike('email', inviteEmail.trim())
        .maybeSingle();

      console.log('Profile lookup result:', existingUser, profileError);

      if (profileError) {
        console.error('Profile lookup error:', profileError);
        throw profileError;
      }

      if (!existingUser) {
        Alert.alert('User Not Found', 'No user found with that email address. They need to sign up first.');
        setInviting(false);
        return;
      }

      console.log('Creating invitation...');
      const { data: invitationData, error: inviteError } = await supabase
        .from('friend_invitations')
        .insert({
          inviter_id: profile.id,
          invitee_email: inviteEmail.toLowerCase(),
          invitee_id: existingUser.id,
        })
        .select()
        .single();

      console.log('Invitation result:', invitationData, inviteError);

      if (inviteError) {
        console.error('Invitation error:', inviteError);
        if (inviteError.code === '23505') {
          Alert.alert('Already Invited', 'You have already invited this user');
        } else {
          Alert.alert('Error', `Failed to send invitation: ${inviteError.message}`);
        }
        setInviting(false);
        return;
      }

      console.log('Creating notification...');
      const notificationPayload = {
        user_id: existingUser.id,
        type: 'friend_invitation',
        title: 'New Friend Request',
        message: `${profile.display_name || profile.email} wants to connect with you`,
        data: { invitation_id: invitationData.id, inviter_id: profile.id },
      };
      console.log('Notification payload:', notificationPayload);

      const { error: notifError } = await supabase.from('notifications').insert(notificationPayload);

      console.log('Notification result:', notifError);

      if (notifError) {
        console.error('Notification error:', notifError);
        Alert.alert('Warning', 'Invitation sent but notification failed. The user may not be notified immediately.');
      } else {
        Alert.alert('Success', 'Invitation sent!');
      }

      setInviteEmail('');
      setShowInviteModal(false);
    } catch (error) {
      console.error('Error sending invitation:', error);
      Alert.alert('Error', 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleAcceptInvitation = async (invitation: FriendInvitation) => {
    if (!profile) return;

    try {
      const userId1 = invitation.inviter_id < profile.id ? invitation.inviter_id : profile.id;
      const userId2 = invitation.inviter_id < profile.id ? profile.id : invitation.inviter_id;

      await supabase.from('friendships').insert({
        user_id: invitation.inviter_id,
        friend_id: profile.id,
        status: 'accepted',
      });

      await supabase.from('shared_spaces').insert({
        user1_id: userId1,
        user2_id: userId2,
      });

      await supabase
        .from('friend_invitations')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', invitation.id);

      await supabase.from('notifications').insert({
        user_id: invitation.inviter_id,
        type: 'invitation_accepted',
        title: 'Friend Request Accepted',
        message: `${profile.display_name || profile.email} accepted your friend request`,
        data: { user_id: profile.id },
      });

      Alert.alert('Success', 'Friend request accepted!');
      loadFriends();
      loadInvitations();
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'Failed to accept invitation');
    }
  };

  const handleDeclineInvitation = async (invitation: FriendInvitation) => {
    try {
      await supabase
        .from('friend_invitations')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', invitation.id);

      setInvitations((prev) => prev.filter((i) => i.id !== invitation.id));
    } catch (error) {
      console.error('Error declining invitation:', error);
      Alert.alert('Error', 'Failed to decline invitation');
    }
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    Alert.alert(
      'Remove Friend',
      'Are you sure you want to remove this friend? This will also delete your shared watchlist.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('friendships').delete().eq('id', friendshipId);
              loadFriends();
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert('Error', 'Failed to remove friend');
            }
          },
        },
      ]
    );
  };

  const renderInvitation = ({ item }: { item: InvitationWithProfile }) => (
    <View style={styles.invitationCard}>
      <View style={styles.invitationInfo}>
        <View style={styles.avatar}>
          <Users size={24} color="#e50914" />
        </View>
        <View style={styles.invitationDetails}>
          <Text style={styles.invitationEmail}>
            {item.inviter?.display_name || item.inviter?.email || 'Someone'}
          </Text>
          <Text style={styles.invitationText}>wants to connect with you</Text>
        </View>
      </View>
      <View style={styles.invitationActions}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => handleAcceptInvitation(item)}
        >
          <Check size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.declineButton}
          onPress={() => handleDeclineInvitation(item)}
        >
          <X size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFriend = ({ item }: { item: FriendWithProfile }) => (
    <TouchableOpacity
      style={styles.friendCard}
      onPress={() => router.push({
        pathname: '/(tabs)/friends/shared',
        params: { friendId: item.friend.id }
      })}
    >
      <View style={styles.friendInfo}>
        <View style={styles.avatar}>
          <Users size={24} color="#e50914" />
        </View>
        <View>
          <Text style={styles.friendName}>{item.friend.display_name || 'User'}</Text>
          <Text style={styles.friendEmail}>{item.friend.email}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveFriend(item.id)}
      >
        <Trash2 size={18} color="#999" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e50914" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => setShowNotifications(true)}
          >
            <Bell size={20} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={() => setShowInviteModal(true)}
          >
            <UserPlus size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {invitations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending Invitations</Text>
          <FlatList
            data={invitations}
            renderItem={renderInvitation}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Friends</Text>
        {friends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Users size={48} color="#333" />
            <Text style={styles.emptyText}>No friends yet</Text>
            <Text style={styles.emptySubtext}>
              Invite friends to start watching together
            </Text>
          </View>
        ) : (
          <FlatList
            data={friends}
            renderItem={renderFriend}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
          />
        )}
      </View>

      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Friend</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Enter email address"
              placeholderTextColor="#666"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!inviting}
            />

            <TouchableOpacity
              style={[styles.sendButton, inviting && styles.sendButtonDisabled]}
              onPress={handleInviteFriend}
              disabled={inviting}
            >
              {inviting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sendButtonText}>Send Invitation</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        onNotificationCountChange={setUnreadCount}
        onFriendAdded={() => {
          loadFriends();
          loadInvitations();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  inviteButton: {
    backgroundColor: '#e50914',
    padding: 12,
    borderRadius: 8,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  list: {
    paddingBottom: 16,
  },
  invitationCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  invitationInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  invitationDetails: {
    flex: 1,
  },
  invitationEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  invitationText: {
    fontSize: 14,
    color: '#999',
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#10b981',
    padding: 10,
    borderRadius: 8,
  },
  declineButton: {
    backgroundColor: '#ef4444',
    padding: 10,
    borderRadius: 8,
  },
  friendCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  friendEmail: {
    fontSize: 13,
    color: '#999',
  },
  removeButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
  },
  sendButton: {
    backgroundColor: '#e50914',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  notificationButton: {
    position: 'relative',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#e50914',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
