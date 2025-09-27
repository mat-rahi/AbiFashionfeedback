submitFeedback()
 {
    if (!this.audioBlob || !this.userEmail.value.trim()) {
        this.showStatus('Please provide your email and record feedback', 'error');
        return;
    }
    
    // Create form data to send to server
    const formData = new FormData();
    formData.append('email', this.userEmail.value);
    formData.append('audioFeedback', this.audioBlob, 'feedback.wav');
    
    try {
        this.showStatus('Submitting feedback...', 'success');
        
        const response = await fetch('http://localhost:3000/api/feedback', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            this.showStatus('Feedback submitted successfully!', 'success');
            this.resetForm();
        } else {
            this.showStatus(data.message || 'Error submitting feedback', 'error');
        }
        
    } catch (error) {
        console.error('Error submitting feedback:', error);
        this.showStatus('Error submitting feedback. Please try again.', 'error');
    }
}