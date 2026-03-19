import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Notification, FriendInvitation, Profile } from '@/types/database';
import { X, Check, UserPlus, Users, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';

type NotificationsModalProps = {
  visible: boolean;
  onClose: () => void;
  onNotificationCountChange?: (count: number) => void;
  onFriendAdded?: () => void;
};

export default function NotificationsModal({
  visible,
  onClose,
  onNotificationCountChange,
  onFriendAdded,
}: NotificationsModalProps) {
  const { profile } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFriendRequestPopup, setShowFriendRequestPopup] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<FriendInvitation | null>(null);
  const [inviterProfile, setInviterProfile] = useState<Profile | null>(null);
  const [processingRequest, setProcessingRequest] = useState(false);

  useEffect(() => {
    if (visible && profile) {
      loadNotifications();
    }
  }, [visible, profile]);

  const loadNotifications = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);

      const unreadCount = (data || []).filter(n => !n.read).length;
      onNotificationCountChange?.(unreadCount);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );

      const unreadCount = notifications.filter(n => !n.read && n.id !== notificationId).length;
      onNotificationCountChange?.(unreadCount);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      const unreadCount = notifications.filter(n => !n.read && n.id !== notificationId).length;
      onNotificationCountChange?.(unreadCount);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    await markAsRead(notification.id);

    if (notification.type === 'friend_invitation') {
      const invitationId = notification.data?.invitation_id;
      if (invitationId) {
        try {
          const { data: invitation, error: invError } = await supabase
            .from('friend_invitations')
            .select('*')
            .eq('id', invitationId)
            .maybeSingle();

          if (invError || !invitation) {
            Alert.alert('Error', 'Could not load friend request');
            return;
          }

          const { data: inviter, error: profError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', invitation.inviter_id)
            .single();

          if (profError || !inviter) {
            Alert.alert('Error', 'Could not load inviter profile');
            return;
          }

          setSelectedInvitation(invitation);
          setInviterProfile(inviter);
          setShowFriendRequestPopup(true);
        } catch (error) {
          console.error('Error loading invitation:', error);
          Alert.alert('Error', 'Could not load friend request');
        }
      }
    } else if (notification.type === 'invitation_accepted' && notification.data?.user_id) {
      onClose();
      router.push({
        pathname: '/(tabs)/friends/shared',
        params: { friendId: notification.data.user_id }
      });
    }
  };

  const handleAcceptRequest = async () => {
    if (!profile || !selectedInvitation) return;

    setProcessingRequest(true);
    try {
      const { error: updateError } = await supabase
        .from('friend_invitations')
        .update({ status: 'accepted' })
        .eq('id', selectedInvitation.id);

      if (updateError) throw updateError;

      const { error: insertError } = await supabase.from('friendships').insert({
        user_id: profile.id,
        friend_id: selectedInvitation.inviter_id,
        status: 'accepted',
      });

      if (insertError) throw insertError;

      await supabase.from('notifications').insert({
        user_id: selectedInvitation.inviter_id,
        type: 'invitation_accepted',
        title: 'Friend Request Accepted',
        message: `${profile.display_name || profile.email} accepted your friend request`,
        data: { user_id: profile.id },
      });

      await deleteNotification(
        notifications.find(n => n.data?.invitation_id === selectedInvitation.id)?.id || ''
      );

      setShowFriendRequestPopup(false);
      setSelectedInvitation(null);
      setInviterProfile(null);
      onFriendAdded?.();

      Alert.alert('Success', 'Friend request accepted!');
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'Failed to accept friend request');
    } finally {
      setProcessingRequest(false);
    }
  };

  const handleDeclineRequest = async () => {
    if (!selectedInvitation) return;

    setProcessingRequest(true);
    try {
      const { error } = await supabase
        .from('friend_invitations')
        .update({ status: 'declined' })
        .eq('id', selectedInvitation.id);

      if (error) throw error;

      await deleteNotification(
        notifications.find(n => n.data?.invitation_id === selectedInvitation.id)?.id || ''
      );

      setShowFriendRequestPopup(false);
      setSelectedInvitation(null);
      setInviterProfile(null);

      Alert.alert('Declined', 'Friend request declined');
    } catch (error) {
      console.error('Error declining invitation:', error);
      Alert.alert('Error', 'Failed to decline friend request');
    } finally {
      setProcessingRequest(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_invitation':
        return <UserPlus size={20} color="#e50914" />;
      case 'invitation_accepted':
        return <Check size={20} color="#10b981" />;
      case 'shared_item_added':
        return <Users size={20} color="#3b82f6" />;
      default:
        return <Users size={20} color="#999" />;
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.unreadCard]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationIcon}>
        {getNotificationIcon(item.type)}
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{item.title}</Text>
        <Text style={styles.notificationMessage}>{item.message}</Text>
        <Text style={styles.notificationTime}>
          {new Date(item.created_at).toLocaleDateString()} at{' '}
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteNotification(item.id)}
      >
        <Trash2 size={18} color="#666" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Notifications</Text>
              <TouchableOpacity onPress={onClose}>
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#e50914" />
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Users size={48} color="#333" />
                <Text style={styles.emptyText}>No notifications</Text>
                <Text style={styles.emptySubtext}>
                  You'll see friend requests and updates here
                </Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                renderItem={renderNotification}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showFriendRequestPopup}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFriendRequestPopup(false)}
      >
        <View style={styles.popupOverlay}>
          <View style={styles.popupContent}>
            <View style={styles.popupHeader}>
              <Text style={styles.popupTitle}>Friend Request</Text>
              <TouchableOpacity
                onPress={() => setShowFriendRequestPopup(false)}
                disabled={processingRequest}
              >
                <X size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.popupBody}>
              <View style={styles.popupAvatar}>
                <Users size={48} color="#e50914" />
              </View>
              <Text style={styles.popupName}>
                {inviterProfile?.display_name || inviterProfile?.email || 'Someone'}
              </Text>
              <Text style={styles.popupMessage}>wants to connect with you</Text>
            </View>

            <View style={styles.popupActions}>
              <TouchableOpacity
                style={[styles.popupButton, styles.declinePopupButton]}
                onPress={handleDeclineRequest}
                disabled={processingRequest}
              >
                <X size={20} color="#fff" />
                <Text style={styles.popupButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.popupButton, styles.acceptPopupButton]}
                onPress={handleAcceptRequest}
                disabled={processingRequest}
              >
                {processingRequest ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Check size={20} color="#fff" />
                    <Text style={styles.popupButtonText}>Accept</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  list: {
    padding: 16,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  unreadCard: {
    backgroundColor: '#2a2a2a',
    borderLeftWidth: 3,
    borderLeftColor: '#e50914',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: 12,
    color: '#666',
  },
  deleteButton: {
    padding: 8,
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  popupContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  popupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  popupBody: {
    alignItems: 'center',
    marginBottom: 24,
  },
  popupAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  popupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  popupMessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  popupActions: {
    flexDirection: 'row',
    gap: 12,
  },
  popupButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  acceptPopupButton: {
    backgroundColor: '#10b981',
  },
  declinePopupButton: {
    backgroundColor: '#ef4444',
  },
  popupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
